# Architecture

> Internal architecture reference for yardmaster (yardmaster package version in `yardmaster/package.json`).

## System overview

```
┌─────────────────────────────────────────────────────┐
│                     CLI Layer                       │
│  parse.ts → dispatch.ts → help.ts                   │
│  Tokenizes argv, routes to command handlers         │
└──────────────┬──────────────────────────────────────┘
               │
       ┌───────┴────────┐
       │                │
┌──────▼──────┐  ┌──────▼──────────────────────────────┐
│  ACP path   │  │  Provider diagnostics / compat      │
│  (run,      │  │  shims                              │
│  design,    │  │  providers doctor → default-checks  │
│  commit,    │  │  + doctor-helpers                   │
│  debug,     │  │  providers/registry.ts keeps        │
│  review)    │  │  compatibility export names only    │
│  acp/run +  │  │                                      │
│  acp/       │  │  execution/: envelopes, aliases,    │
│  command-   │  │  persistence, fallback helpers      │
│  runner     │  │                                      │
└──────┬──────┘  └──────────────┬──────────────────────┘
       │                        │
       └──────────┬─────────────┘
                  │
┌─────────────────▼───────────────────────────────────┐
│                  Config Layer                       │
│  schema.ts → store.ts                               │
│  Zod-validated config with 5-level precedence       │
│  flags > env > project > user > defaults            │
└─────────────────────────────────────────────────────┘
```

Prompt commands and **`review`** use ACP helpers (`acp/client.ts`, `acp/run.ts`, `acp/command-runner.ts`, `acp/fallback.ts`) to spawn ACP agent processes and stream JSON-RPC. **`yardmaster providers doctor`** still shells out to installed CLIs via `providers/default-checks.ts` and `providers/doctor-helpers.ts`. `providers/registry.ts` remains only as a compatibility export surface for older names, not as the canonical execution layer.

## Module map

```
src/
├── index.ts                 # Entry point — delegates to cli()
├── cli.ts                   # Top-level orchestrator: parse → dispatch → exit
├── types.ts                 # Core types: ProviderId, config-facing provider tokens, request/output shapes
├── errors.ts                # Error hierarchy: UsageError, RuntimeProviderError, AuthConfigurationError, TimeoutError, AggregatedProviderError, AcpProtocolError
├── error-format.ts          # User-facing error formatting with next-step suggestions
│
├── acp/                     # ACP execution helpers for run/design/commit/debug/review
│   ├── client.ts            # Spawn agent, initialize, session, prompt, close
│   ├── run.ts               # runViaAcp() entry from dispatch
│   ├── command-runner.ts    # Shared ACP invocation helper for non-run flows
│   ├── provider-registry.ts # ACP launcher metadata for claude / codex / gemini / cursor-agent
│   ├── session-store.ts     # Named session persistence
│   ├── fallback.ts          # Provider order + ACP retries
│   ├── host-handlers.ts     # Filesystem, terminal, permission delegation
│   ├── parallel-runner.ts   # Parallel ACP work where used
│   └── types.ts             # ACP-specific types
│
├── output/
│   └── stream-renderer.ts   # Terminal rendering for streamed ACP events
│
├── cli/
│   ├── parse.ts             # argv → ParsedCommand router
│   ├── dispatch.ts          # ParsedCommand → handler router
│   ├── help.ts              # Help topic dispatcher
│   ├── types.ts             # CLI-specific types (HelpTopic, ParsedCommand variants)
│   ├── input.ts             # Prompt file/stdin reading
│   ├── json.ts              # JSON envelope formatting
│   ├── output.ts            # Output writing utilities
│   ├── safety.ts            # Destructive operation confirmations
│   ├── validate.ts          # Argument validation helpers
│   ├── completion.ts        # Shell completion script generation
│   ├── parse/
│   │   ├── commands.ts      # Root command token map
│   │   ├── prompt-commands.ts  # Parsers for run/design/commit/debug
│   │   ├── state-commands.ts   # Parsers for review/config/presets/providers/update
│   │   ├── shared.ts        # Shared parsing utilities
│   │   └── state/           # Per-command state parsers
│   ├── dispatch/
│   │   ├── prompt-commands.ts  # Handlers for run/design/commit/debug
│   │   ├── state-commands.ts   # Handlers for review/config/presets/providers/update
│   │   ├── shared.ts        # Shared dispatch utilities
│   │   └── state/           # Per-command state dispatchers
│   └── help/
│       ├── root.ts          # Root help screen builder
│       └── topics.ts        # Per-command help text arrays
│
├── providers/
│   ├── doctor.ts            # Provider health check (doctor) command
│   ├── doctor-helpers.ts    # Doctor target resolution + auth hints
│   ├── doctor-types.ts      # Doctor result types
│   ├── default-checks.ts    # Default availability/auth check implementations
│   ├── registry.ts          # Compatibility re-exports for older provider-registry imports
│   ├── base.ts              # Shared command runner used by doctor checks
│   ├── codex-auth.ts        # Version-tolerant Codex auth probe
│   └── redact.ts            # Strips operator identity from doctor output
│
├── execution/
│   ├── request-schema.ts    # Zod schema for request validation (shared)
│   ├── fallback.ts          # Fallback helpers used outside the ACP prompt path
│   ├── fallback-helpers.ts  # Fallback utility functions
│   ├── provider-order.ts    # resolveProviderOrder() / resolveProviderExecutionPlan()
│   ├── provider-aliases.ts  # Provider alias resolution (e.g. pi → backend)
│   ├── envelopes.ts         # Response envelope construction
│   └── persist.ts           # Result persistence utilities
│
├── config/
│   ├── schema.ts            # YardmasterConfig Zod schema, defaults, mergeConfig()
│   ├── store.ts             # Load/save/update config from disk
│   └── commands.ts          # Config subcommand implementations
│
├── review/
│   ├── command.ts           # Review command entry point
│   ├── execute.ts           # Multi-agent review execution
│   ├── select.ts            # Review agent selection and validation
│   ├── diff-source.ts       # Diff source resolution (file, staged, base, default)
│   ├── git-service.ts       # Git operations (branch, head, diff)
│   ├── git-context.ts       # Git context resolution
│   ├── git-diff.ts          # Git diff parsing
│   ├── contracts.ts         # Review result types (ReviewExecutionResult, ReviewJsonEnvelope)
│   ├── schema.ts            # Review JSON schema and envelope builder
│   ├── format.ts            # Human-readable review output formatting
│   └── report.ts            # Review report generation
│
├── commit/
│   └── command.ts           # Commit message generation from staged diff
│
├── debug/
│   └── command.ts           # Error diagnosis from piped terminal output
│
├── design/
│   └── command.ts           # Frontend design feedback command
│
├── update/
│   └── command.ts           # CLI self-update (build + link)
│
├── presets/
│   └── commands.ts          # Preset CRUD subcommands
│
└── runtime/
    ├── workspace.ts         # Workspace path resolution
    └── tty.ts               # TTY detection and output mode resolution
```

## Request lifecycle

```
1. CLI Input (argv)
   │
2. parseArgv()
   │  Tokenize arguments, identify command, extract flags
   │  → ParsedCommand (discriminated union with ~13 variants)
   │
3. executeCommand()
   │  Pattern-match on ParsedCommand.kind
   │  ├── help/version → print and exit
   │  ├── prompt commands (run, design, commit, debug) → prompt handler
   │  └── state commands (review, config, presets, providers, update) → state handler
   │
4. loadConfig()
   │  Merge: defaults ← user config ← project config ← env vars ← CLI flags
   │
5. normalizeRequest() (where applicable)
   │  Validate with Zod, apply config defaults, resolve workspace
   │  → NormalizedRequest (all fields required)
   │
6. resolveProviderOrder()
   │  Determine provider attempt sequence from config + explicit flag
   │  → ProviderId[] (e.g. ['codex', 'claude', 'gemini', 'cursor-agent'])
   │
7. ACP execution
   │  runViaAcp() / runAcpCommand()
   │  ├── Resolve ACP launcher metadata from provider-registry
   │  ├── initialize → session → prompt (stream) → close
   │  └── Map protocol/auth failures to the shared error hierarchy
   │
8. Output
   ├── --json → YardmasterResponseEnvelope (structured)
   ├── --plain → response text only
   └── default → formatted response
```

## Provider diagnostics

`providers/` is no longer the main execution layer for prompt commands or review. It remains for provider discovery, `yardmaster providers doctor`, and compatibility exports consumed by older imports/tests.

`yardmaster providers doctor` shells out to installed CLIs and reports availability, authentication, latency, and actionable hints. The main pieces are:

- `providers/doctor.ts` — doctor command entrypoint
- `providers/doctor-helpers.ts` — target resolution, Cursor-specific hinting, auth/availability orchestration
- `providers/default-checks.ts` — shared availability/auth probes (`--version`, `auth status`, `agent status`)
- `providers/codex-auth.ts` — Codex auth probe that tries `codex login status`, then `codex auth status`, then `~/.codex/auth.json`, then reports an unsupported CLI version
- `providers/redact.ts` — replaces identity-bearing values in doctor detail fields unless `--show-identity` is passed
- `providers/registry.ts` — compatibility re-exports of ACP provider metadata for older callers/tests

ACP launcher metadata lives in `acp/provider-registry.ts`, which currently defines `claude`, `codex`, `gemini`, and `cursor-agent` launchers plus env/auth requirements for those ACP agents.

## Config system

**Schema** (Zod-validated in `config/schema.ts`):

```
YardmasterConfig
├── provider.default: ProviderId        # Default: 'claude'
├── provider.fallbackOrder: ProviderId[] # Default: all providers
├── model.byProvider: Record<string, string>
├── mode.default: string                # Default: 'default'
├── workspace.last?: string
├── output.default: CliOutputMode       # Default: 'auto'
├── trust.default: boolean              # Default: false
├── runtime.timeoutMs: number           # Default: 30000, max: 300000
├── presets.default?: string
└── presets.named: Record<string, ProviderPreset>
```

**Precedence** (highest wins):
1. CLI flags (`--provider`, `--model`, etc.)
2. Environment variables (`YARDMASTER_PROVIDER`, `YARDMASTER_MODEL`, etc.)
3. Project config (`.yardmaster/config.json`)
4. User config (`~/.config/yardmaster/config.json`)
5. Hardcoded defaults

## Error hierarchy

```
Error
├── UsageError           → exit 2   (invalid arguments)
├── AuthConfigurationError → exit 3 (auth not configured)
├── TimeoutError         → exit 124 (provider timeout)
├── RuntimeProviderError → exit 1   (provider failed)
└── AggregatedProviderError → exit 1/3/124
    ├── All auth failures → exit 3
    ├── Any timeout       → exit 124
    └── Otherwise         → exit 1
```

All errors are formatted with context-specific "Next steps" suggestions via `formatCliError()`.

## Review system

The review system resolves a git diff, maps requested review agents to ACP providers, and runs those ACP prompts in parallel:

```
yardmaster review [--all | --agent <id>] [--diff-file | --staged | --base <ref>]
                     │
                     ▼
              Resolve diff source
              ├── --diff-file → read file
              ├── --staged → git diff --staged
              ├── --base → git diff <ref>..HEAD
              └── default → git diff HEAD
                     │
                     ▼
              Resolve review targets
              ├── --all → [codex, claude, gemini, cursor]
              └── --agent → [single agent]
                     │
                     ▼
              Execute in parallel
              (each agent → runAcpCommand() → ACP provider)
                     │
                     ▼
              ReviewExecutionResult
              ├── Human text (default)
              └── ReviewJsonEnvelope (--json)
```

Review agents: `codex`, `claude`, `gemini`, `cursor`

## Design patterns

| Pattern | Where | Purpose |
|---------|-------|---------|
| Registry | `acp/provider-registry.ts` | Stable ACP launcher metadata per provider |
| Discriminated Union | `ParsedCommand` variants | Type-safe command dispatch |
| Chain of Responsibility | Config loading from 5 sources | Precedence-based merging |
| Strategy | Provider selection at runtime | Swappable ACP backends |
| Fallback/Retry | `acp/fallback.ts` + `execution/fallback.ts` | ACP and helper retry behavior |

## Extension points

1. **New ACP-backed provider**: Add an entry to `acp/provider-registry.ts`, extend `ProviderId` / config as needed, and keep `providers/doctor.ts` / `doctor-helpers.ts` able to diagnose the CLI the provider depends on.
2. **New command**: Add parser in `cli/parse/`, dispatcher in `cli/dispatch/`, help in `cli/help/topics.ts`. Reuse `runViaAcp()` or `runAcpCommand()` if the command is prompt-driven.
3. **Config option**: Extend Zod schema in `config/schema.ts`, add loading in `config/store.ts`.
4. **New error type**: Create in `errors.ts`, add exit code mapping, add formatting in `error-format.ts`.
