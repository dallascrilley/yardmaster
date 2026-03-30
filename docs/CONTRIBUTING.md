# Contributing

Guidelines for developing and extending genie-cli.

## Key Resources
- **Architecture**: See [ARCHITECTURE.md](ARCHITECTURE.md) for system design and module map.
- **API Reference**: See [API.md](API.md) for types and contracts.
- **Capabilities**: Explore the [genie-dispatch skill](../.claude/skills/genie-dispatch/SKILL.md) for provider strengths.

## Prerequisites

- Node.js 18+
- Bun (for dependency management and running)
- At least one provider CLI installed (claude, codex, gemini, or cursor-agent)
- For **Cursor** ACP (`genie run` / `genie review` with `cursor-agent`): the **`agent`** binary from the Cursor CLI must be on `PATH`, or set **`GENIE_CURSOR_ACP_BIN`** to its full path (often `~/.local/bin/agent`). Run `agent login` (or use `CURSOR_API_KEY` / docs) so `authenticate` can succeed.
- For **Gemini** ACP, the installed **`gemini`** CLI must support **`--acp`** (current documented mode).

## Setup

```bash
cd genie
bun install
bun run build
bun link
```

Verify with `genie --help`.

## Development workflow

```bash
cd genie

# Type-check without emitting
bun run typecheck

# Run tests
bun run test

# Build (TypeScript → dist/)
bun run build
```

Or use the justfile from the project root:

```bash
just qa          # typecheck + test + build
just ci          # install + typecheck + test + build
just typecheck
just test
just build
```

Targeted contract verification that landed after the initial command rollout:

```bash
cd genie
bun run test:critical-path
```

That suite covers bootstrap help flows, prompt commands, stateful commands, update behavior, and the linked `genie` binary in isolated temp homes and git workspaces.

### Smoke tests (optional, slow)

Real-LLM smoke lives in `genie/test/smoke/` (`bun run test:smoke`). It is **provider-dependent** and can take several minutes when many CLIs are installed.

- **Narrow providers locally**: `GENIE_SMOKE_PROVIDERS=gemini` (comma-separated) limits the matrix; unavailable providers are skipped per `genie providers doctor`.
- **Quick default (Gemini-only)**: `bun run test:smoke:preflight` sets that filter for you (still needs a working Gemini auth for non-skipped cases).
- **Scheduled CI**: [`.github/workflows/smoke.yml`](../.github/workflows/smoke.yml) runs on `workflow_dispatch` and a daily cron; configure the **`GEMINI_API_KEY`** repository secret for the job to pass global setup. Forks do not receive upstream secrets—expect skips or failures unless secrets are provided.

## CI / GitHub Actions

The gate you care about is [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (`bun install --frozen-lockfile`, `typecheck`, `test`, `build`, `test:critical-path` in `genie/`).

The obsolete **`BuildFailed`** workflow (historical id `253562637`) is **`deleted`** in the GitHub Actions API (`state: deleted`). You should only see **CI** and **Smoke Tests** under active workflows. Older PRs may still list historical **`startup_failure`** rows for that deleted workflow; new PRs should surface **`ci.yml`** as the primary check. If an empty-name ghost reappears, a repo admin can clean it under **Settings → Actions**.

## Project structure

```
genie-cli/
├── genie/                  # Main package
│   ├── src/                # TypeScript source
│   │   ├── cli/            # Parsing and dispatch
│   │   ├── acp/            # ACP client (run, design, commit, debug)
│   │   ├── output/         # Stream rendering for ACP
│   │   ├── providers/      # Adapters for doctor, review, legacy spawn surfaces
│   │   ├── execution/      # Envelopes, provider order, fallback helpers
│   │   ├── config/         # Configuration
│   │   ├── review/         # Code review (spawn-based multi-agent path)
│   │   ├── commit/         # Commit message generation (invoked via ACP from CLI)
│   │   ├── debug/          # Error diagnosis
│   │   ├── design/         # Design feedback
│   │   ├── update/         # Self-update
│   │   ├── presets/        # Preset management
│   │   └── runtime/        # Workspace and TTY
│   ├── dist/               # Build output
│   └── package.json
├── justfile                # Task runner recipes
├── docs/                   # Documentation
└── specs/                  # Feature specifications
```

## Adding a new provider

**Prompt commands (`run`, `design`, `commit`, `debug`)** go through ACP:

1. Add an `AcpProviderEntry` in `genie/src/acp/provider-registry.ts` (launcher binary or `npx` package, optional `resolveEnv`).
2. Extend `ProviderId` and any defaults in `genie/src/types.ts` and `genie/src/config/schema.ts` if the id is new.
3. Keep **`genie providers doctor`** accurate: add a matching `ProviderAdapter` in `genie/src/providers/<name>.ts`, register it in `genie/src/providers/registry.ts`, and add `genie/src/providers/mapped-args/<name>.ts` if that CLI needs custom flags for **review** or other spawn paths.
4. Add help text in `genie/src/cli/help/topics.ts` and update `genie/src/cli/completion.ts`.

If the provider is **review-only** or has no ACP agent yet, you can start with steps 3–4 only and omit the `acp/` entry until an ACP launcher exists (see `docs/specs/2026-03-30-acp-rewrite-design.md` § cursor-agent).

## Adding a new command

1. **Parse**: Add parser function in `genie/src/cli/parse/` (prompt-commands or state-commands)
2. **Dispatch**: Add handler in `genie/src/cli/dispatch/` (prompt-commands or state-commands)
3. **Help**: Add help topic in `genie/src/cli/help/topics.ts` and register in `help.ts`
4. **Types**: Add `ParsedCommand` variant in `genie/src/cli/types.ts`
5. **Completions**: Update shell completion generator

## Conventions

### Code style
- TypeScript strict mode
- No default exports — use named exports
- Zod for runtime validation of external data (config, CLI args)
- Discriminated unions for type-safe dispatch

### Naming
- Command handlers: `handle<Command>Command()`
- Parsers: `parse<Command>Args()`
- Checks: `is<State>()`, `<action>Check()`
- Resolvers: `resolve<Thing>()`
- Converters: `to<Format>()`, `from<Format>()`
- Types: `<Feature>Options`, `<Feature>Result`, `<Feature>Envelope`

### Error handling
- Use the error classes from `errors.ts` (never throw raw strings)
- `UsageError` for bad input (exit 2)
- `AuthConfigurationError` for auth problems (exit 3)
- `TimeoutError` for timeouts (exit 124)
- `RuntimeProviderError` for provider failures (exit 1)
- Always include actionable "next steps" in error messages

### I/O contract
- stdout: response payload or machine output only
- stderr: diagnostics, warnings, and errors only
- `--json`: stable envelope with `kind`, `version`, `ok`, `exitCode`, `error`, and typed payload
- `--plain`: response text only, no formatting
- `--verbose`: extra diagnostics on stderr
- `--quiet`: suppress confirmation-only success chatter
- `--no-color` and `--no-input`: force non-interactive child-process behavior where supported

### Troubleshooting docs maintenance
- Update [`docs/TROUBLESHOOTING.md`](./TROUBLESHOOTING.md) whenever provider checks, auth diagnostics, timeout behavior, or user-facing error next-steps change.
- Keep recovery commands aligned with current CLI help text and actual error messages from provider adapters and `error-format.ts`.

### Commits
- Use Conventional Commits format
- Examples: `feat(cli):`, `fix(providers):`, `refactor(config):`, `test(review):`
