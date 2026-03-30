# ACP Rewrite Design

Replace genie's CLI-spawn-and-parse provider layer with native ACP (Agent Client Protocol) communication. Genie becomes a thin ACP client that spawns ACP agent servers, negotiates capabilities, forwards prompts, streams responses, and manages sessions.

## Motivation

Genie currently spawns provider CLIs (`claude`, `codex`, `gemini`, `cursor-agent`) as child processes, constructs provider-specific flags, and parses unstructured stdout/stderr. This creates:

- 4 separate adapter files with custom flag translation and output parsing
- Fragile text parsing that breaks when providers change their output format
- No streaming (wait for process exit, then dump output)
- No session continuity (every invocation is stateless)
- Per-provider auth checking logic

ACP standardizes all of this into a single JSON-RPC 2.0 protocol over stdio. The three main providers already have ACP adapters:

- `codex` via `@zed-industries/codex-acp`
- `claude` via `@zed-industries/claude-agent-acp`
- `gemini` speaks ACP natively

## Architecture

```
genie CLI
    │
    ├── cli/          (unchanged — parse, dispatch, help)
    ├── config/       (unchanged — schema, store, 5-level merge)
    │
    ├── acp/          (NEW — replaces providers/ + execution/)
    │   ├── client.ts
    │   ├── provider-registry.ts
    │   ├── session-store.ts
    │   ├── streaming.ts
    │   ├── fallback.ts
    │   └── types.ts
    │
    ├── commands/     (NEW — called by cli/dispatch/, replaces inline handler logic)
    │   ├── run.ts
    │   ├── commit.ts
    │   ├── debug.ts
    │   ├── design.ts
    │   └── review.ts
    │
    └── output/       (NEW — streaming requires extraction from cli/)
        ├── format.ts
        └── stream-renderer.ts
```

### Implementation status (main, post-merge)

Tracked here so contributors can compare this spec to the tree on `main`:

- **Prompt commands** (`run`, `design`, `commit`, `debug`): Implemented via `acp/run.ts`, `acp/client.ts`, `acp/fallback.ts`, and `acp/provider-registry.ts`. Named sessions use `acp/session-store.ts`. Streaming uses `output/stream-renderer.ts`.
- **ACP registry entries**: **claude**, **codex**, and **gemini** only. **`cursor-agent`** remains a valid `ProviderId` and appears in doctor/review adapters; there is still **no** ACP launcher row for it (see § `cursor-agent` deprecation below).
- **`review`**: **Not migrated** — still `review/execute.ts` and spawn-based provider adapters. Next large milestone is to align review with the ACP session model (parallel agents, error mapping, integration tests) or to amend this spec if the legacy path stays intentional.
- **`execution/`**: No longer contains `run-request.ts` / `normalize.ts` / `preflight.ts` as top-level modules; remaining files support envelopes, provider order, aliases, and fallback helpers.
- **`providers/`**: Still present for **doctor**, **review**, and shared adapter types — not fully deleted as in the original “What is deleted” list below (that section describes the target end-state; the bullets above describe current `main`).

### What is deleted

- `providers/claude.ts`, `codex.ts`, `gemini.ts`, `cursor-agent.ts` — 4 adapter files
- `providers/base.ts` — adapter factory
- `providers/command-runner.ts` — spawn + stdout parsing
- `providers/mapped-args/` — per-provider flag translation
- `providers/registry.ts` — replaced by `acp/provider-registry.ts`
- `providers/doctor.ts`, `doctor-helpers.ts`, `doctor-types.ts` — replaced by ACP-based diagnostics (spawn + `initialize` handshake)
- `execution/run-request.ts`, `normalize.ts`, `preflight.ts` — absorbed into `acp/client.ts`

### What is preserved

- CLI parsing layer (`cli/parse/`, `cli/dispatch/`, `cli/help/`)
- Config merging (`config/schema.ts`, `config/store.ts`)
- Provider ordering and alias system (`pi` -> `gemini`)
- Error hierarchy (extended, not replaced)
- `types.ts` core types (`NormalizedRequest`, `ProviderId`, etc.)

## ACP Client Lifecycle

### Flow

```
resolveAgent(providerId)         — registry lookup → agent command
    │
spawnAgent(agentCommand)         — child_process.spawn, wire stdio
    │
initialize()                     — capability negotiation
    │                              client: fs, terminal support
    │                              agent: streaming, modes, config
    │
session/new(cwd, mcp_servers)    — create session, get session_id
    │                              mcp_servers from --mcp flags + config
    │
session/prompt(content)          — send user prompt
    │  ← ContentChunk              stream text to terminal
    │  ← ToolCallUpdate            show tool activity (optional)
    │  ← PlanUpdate                show plan progress (optional)
    │  → PromptResponse            stop_reason: end_turn
    │
one-shot? close session
named (-s)? persist session_id
```

### Agent spawning

Still `child_process.spawn`, but the child is the ACP adapter process (e.g., `npx @zed-industries/codex-acp`), not the raw CLI. Communication is structured JSON-RPC over stdio pipes.

### Permission delegation

When the ACP agent sends `session/request_permission`, genie maps to existing trust flags:

- `--trust` / `--yolo` → auto-approve
- default → prompt the user in the terminal

### File system and terminal delegation

The ACP agent requests file/terminal access via protocol methods. Genie acts as the host that fulfills these requests.

**Filesystem access (`fs/read_text_file`, `fs/write_text_file`):**

- Scoped to the resolved workspace directory by default. Paths outside the workspace require explicit permission.
- In default mode, write requests trigger a terminal prompt: `Allow agent to write src/api/route.ts? [y/N]`
- With `--trust`, all reads and writes within the workspace are auto-approved.
- With `--yolo`, all reads and writes anywhere are auto-approved.
- The ACP SDK's `ClientSideConnection` provides host-side handler registration for these methods — genie registers handlers, not implements the protocol framing.

**Terminal access (`terminal/create`, `terminal/output`, `terminal/wait_for_exit`, `terminal/kill`, `terminal/release`):**

- Genie spawns subprocesses on behalf of the agent and streams output back.
- Same permission model: default mode prompts, `--trust` auto-approves within workspace, `--yolo` auto-approves all.
- Terminal processes inherit genie's `timeoutMs` config. If a terminal command exceeds the timeout, genie kills it and returns an error to the agent.
- Large output (>1MB) is truncated with a warning to the agent.

**Agent-driven data gathering:** This means agents drive their own data gathering. For `commit`, the agent runs `git diff --staged` itself via `terminal/create` instead of genie pre-injecting the diff. Same for `debug` (terminal history) and `design` (file reading).

### Timeout

Same `timeoutMs` from config. Applied to the `session/prompt` call. If exceeded: send `session/cancel`, then SIGTERM the child process.

## Provider Registry

Simple map replacing 4 adapter files + mapped-args:

```typescript
type AcpProviderEntry = {
  id: ProviderId
  agentCommand: string
  args?: string[]
  resolveEnv?: () => Record<string, string>  // lazy — resolved at spawn time, not module load
  authCheck?: () => Promise<boolean>
}

const providers: Record<ProviderId, AcpProviderEntry> = {
  claude: {
    id: 'claude',
    agentCommand: 'npx',
    args: ['@zed-industries/claude-agent-acp'],
  },
  codex: {
    id: 'codex',
    agentCommand: 'npx',
    args: ['@zed-industries/codex-acp'],
  },
  gemini: {
    id: 'gemini',
    agentCommand: 'gemini',
    resolveEnv: () => ({ GEMINI_API_KEY: process.env.GEMINI_API_KEY }),
  },
}
```

Model override is passed via `session/new` or `session/config` as a session parameter, eliminating per-provider flag translation.

### `cursor-agent` deprecation

`cursor-agent` is omitted from the ACP registry. To avoid breaking existing configs:

- `ProviderId` union keeps `cursor-agent` as a valid value.
- Config loading emits a warning if `cursor-agent` appears in `provider.default` or `provider.fallbackOrder`: `"cursor-agent does not have an ACP adapter yet — skipping"`.
- The fallback chain skips it gracefully (same as today's "not available" check).
- When/if an ACP adapter ships, add a registry entry and remove the warning.

### `npx` spawn strategy

The registry uses `npx` for adapters that are npm packages. To mitigate cold-start and offline issues:

- Recommend global install in docs: `npm install -g @zed-industries/codex-acp @zed-industries/claude-agent-acp`
- If globally installed, the binary name resolves directly and `npx` is not needed. The registry should check for the binary first, fall back to `npx`.
- Pin versions in `npx` calls: `npx @zed-industries/codex-acp@0.10.x`
- `genie providers doctor` reports whether adapters are globally installed vs. requiring `npx`.

## Fallback Chain

Same ordering logic as today, simpler execution:

```
resolveProviderOrder(config, flags)  → ProviderExecutionSlot[]

for each slot:
  ├─ authCheck()           optional pre-spawn validation
  ├─ spawnAgent()          start ACP process
  ├─ initialize()          capability negotiation
  │   └─ fail? → next slot
  ├─ session/new + prompt  do the work
  │   └─ fail? → next slot
  └─ success → return result
```

The alias system is unchanged. `pi` resolves to a provider ID, which resolves to an ACP agent command.

## Sessions

### New CLI flag: `-s / --session <name>`

```bash
genie "add the API" -s feat           # creates session "feat"
genie "now add tests" -s feat         # resumes session "feat"
genie "hello"                         # one-shot (no session persistence)
```

### Session store (`acp/session-store.ts`)

Persists to `~/.config/genie/sessions.json`:

```json
{
  "feat": {
    "agentCommand": "npx @zed-industries/codex-acp",
    "sessionId": "abc-123",
    "cwd": "/Users/dallas/Code/genie-cli",
    "provider": "codex",
    "createdAt": "2026-03-30T00:00:00Z"
  }
}
```

On resume: spawn the same agent command, call `session/load` with the stored `sessionId`.

**Session resume strategy:** Not all ACP adapters may support `session/load`. The resume strategy is:

1. Try `session/load` with the stored `sessionId`.
2. If the adapter returns a "not found" or "not supported" error, fall back to `session/new` and log a warning that session history was lost.
3. Add `lastActiveAt` timestamp to each session entry. Sessions older than 24 hours are cleaned up on next genie invocation.
4. If the adapter process crashed mid-session, the session store entry becomes stale. On next resume attempt, the `session/load` fallback handles this gracefully.

Phase 2 must begin by verifying which adapters support `session/load`. If none do, sessions can still work as "named provider affinity" (always route `-s feat` to the same provider) without cross-invocation context.

### One-shot mode

A one-shot is a session that closes immediately after the prompt response. No entry in the session store.

## Streaming Output

### ACP notifications mapped to terminal output

| ACP Notification | Terminal rendering |
|---|---|
| `ContentChunk` (text) | Streamed markdown |
| `ToolCallUpdate` | `[tool] reading src/api/routes.ts...` (dim) |
| `ToolCallResult` | Hidden by default, `--verbose` shows |
| `PlanUpdate` | Task list with status indicators |

### Output mode matrix

| Mode | TTY (interactive) | Piped (non-TTY) |
|---|---|---|
| `auto` (default) | Stream markdown + tool indicators | Buffer all, emit `GenieResponseEnvelope` JSON |
| `--plain` | Stream raw text chunks, no decoration | Stream raw text chunks |
| `--json` | Buffer all, emit `GenieResponseEnvelope` | Buffer all, emit `GenieResponseEnvelope` |

The `GenieResponseEnvelope` JSON shape is a public contract and must not change without a major version bump.

## Review Command

Parallel named ACP sessions replace parallel CLI spawns:

```
genie review
  ├─ session/new "review-claude" (claude-agent-acp)  [parallel]
  │    system prompt: review for correctness
  │    ← streaming results
  │
  ├─ session/new "review-codex" (codex-acp)          [parallel]
  │    system prompt: review for bugs
  │    ← streaming results
  │
  └─ merge + deduplicate findings
```

Named sessions enable follow-up: `genie -s review-claude "explain finding #3"`

### Error isolation

One provider failure must not abort the others. Each parallel session runs independently:

- If one ACP adapter crashes mid-stream, its results are marked as failed in the merged report. The other session continues.
- Partial results from a failed session are included if any content was streamed before failure.
- Concurrent streaming output is rendered in sequential sections (provider A's full output, then provider B's), not interleaved. A progress indicator shows which providers are still working.

## Error Handling

### ACP error code mapping

| ACP Error | Genie Error | Exit Code |
|---|---|---|
| `-32000` (auth required) | `AuthConfigurationError` | 3 |
| `-32601` (method not found) | `RuntimeProviderError` | 1 |
| `-32603` (internal error) | `RuntimeProviderError` | 1 |
| Agent spawn failure | `RuntimeProviderError` | 1 |
| `session/cancel` timeout | `TimeoutError` | 124 |
| No provider available | `AggregatedProviderError` | 1/3/124 |

New `AcpProtocolError` class wraps JSON-RPC error codes. User-facing messages in `error-format.ts` remain unchanged.

## Testing Strategy

### Unit tests

Mock `ClientSideConnection` from the ACP SDK. One mock pattern replaces four provider-specific mocks.

### Integration tests

Build a fake ACP server using `AgentSideConnection` from the SDK. This test server:

- Responds with canned text
- Simulates streaming (multiple `ContentChunk` notifications)
- Triggers `session/request_permission` to test trust handling
- Returns ACP errors to test error mapping

One fake server covers all providers — they all speak the same protocol.

### E2E smoke tests

Real ACP adapters against real LLMs, gated behind API keys. Same approach as current `feat/e2e-smoke-tests` branch.

## Dependencies

### Added

- `@agentclientprotocol/sdk` (v0.17.x) — zero transitive deps, actively maintained

### Removed

None (zod stays, no new heavy deps)

## Migration Plan

| Phase | Scope | What ships |
|---|---|---|
| 1 | `run` command over ACP + `providers doctor` | Core ACP client, registry, streaming, fallback, ACP-based diagnostics |
| 2 | Sessions + `-s` flag | Session store, `session/load` support |
| 3 | `commit`, `debug`, `design` | System-prompt-only commands, agent-driven data gathering |
| 4 | `review` | Parallel named sessions, result merging |
| 5 | Delete old code | Remove `providers/`, `execution/`, mapped-args |

Each phase is a separate PR. Phase 1 is the proof of concept — if ACP adapters are too immature, we stop and reassess without having broken anything.

## Future: A2A Server Surface

Not in scope for this rewrite. The ACP client core is designed to be wrappable by a future A2A HTTP server surface (`genie serve`), making genie discoverable and callable by other agents over the network.

## Risks

| Risk | Mitigation |
|---|---|
| ACP SDK is pre-1.0 (v0.17) | Pin version, vendor types if needed |
| Provider ACP adapters may be buggy | Phase 1 is `run` only — validate before migrating more |
| `cursor-agent` may not have ACP adapter | Omit from initial registry, add when available |
| Session persistence across agent restarts | `session/load` may not be supported by all agents — graceful fallback to `session/new` |
| Model override via ACP not standardized | Fall back to env vars per provider if `session/config` doesn't support it |
