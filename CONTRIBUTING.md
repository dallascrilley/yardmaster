# Contributing

Guidelines for developing and extending yardmaster.

## Key Resources
- **Architecture**: See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for system design and module map.
- **API Reference**: See [API.md](docs/API.md) for types and contracts.

## Prerequisites

- Node.js 18+
- Bun (for dependency management and running)
- At least one provider CLI installed (claude, codex, gemini, or cursor-agent)
- For **Cursor** ACP (`yardmaster run` / `yardmaster review` with `cursor-agent`): the **`agent`** binary from the Cursor CLI must be on `PATH`, or set **`YARDMASTER_CURSOR_ACP_BIN`** to its full path (often `~/.local/bin/agent`). Run `agent login` (or use `CURSOR_API_KEY` / docs) so `authenticate` can succeed.
- For **Gemini** ACP, the installed **`gemini`** CLI must support **`--acp`** (current documented mode).

## Setup

```bash
bun install
bun run build
bun link
```

Verify with `yardmaster --help`.

## Development workflow

```bash

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
bun run test:critical-path
```

That suite covers bootstrap help flows, prompt commands, stateful commands, update behavior, and the linked `yardmaster` binary in isolated temp homes and git workspaces.

### Smoke tests (optional, slow)

Real-LLM smoke lives in `test/smoke/` (`bun run test:smoke`). It is **provider-dependent** and can take several minutes when many CLIs are installed.

- **Narrow providers locally**: `YARDMASTER_SMOKE_PROVIDERS=gemini` (comma-separated) limits the matrix; unavailable providers are skipped per `yardmaster providers doctor`.
- **Quick default (Gemini-only)**: `bun run test:smoke:preflight` sets that filter for you (still needs a working Gemini auth for non-skipped cases).
- **Scheduled CI**: [`.github/workflows/smoke.yml`](.github/workflows/smoke.yml) runs on `workflow_dispatch` and a daily cron; configure the **`GEMINI_API_KEY`** repository secret for the job to pass global setup. Forks do not receive upstream secrets—expect skips or failures unless secrets are provided.

## CI / GitHub Actions

The gate you care about is [`.github/workflows/ci.yml`](.github/workflows/ci.yml): `bun install --frozen-lockfile`, `typecheck`, `test`, `build`, `test:critical-path`. `bun run validate` runs the same sequence locally.

## Project structure

```
.
├── src/                    # TypeScript source
│   ├── cli/                # Parsing and dispatch
│   ├── acp/                # ACP helpers for run/design/commit/debug/review
│   ├── output/             # Stream rendering for ACP
│   ├── providers/          # Provider doctor checks and identity redaction
│   ├── execution/          # Envelopes, provider order, fallback helpers
│   ├── config/             # Configuration
│   ├── review/             # Review orchestration over ACP providers
│   ├── commit/             # Commit message generation (invoked via ACP from CLI)
│   ├── debug/              # Error diagnosis
│   ├── design/             # Design feedback
│   ├── update/             # Self-update
│   ├── presets/            # Preset management
│   └── runtime/            # Workspace and TTY
├── test/                   # Vitest suites (smoke tests under test/smoke/)
├── docs/                   # CLI, architecture, API, troubleshooting
├── justfile                # Task runner recipes
└── package.json
```

## Adding a new provider

**Prompt-driven providers** (`run`, `design`, `commit`, `debug`, and the provider-facing part of `review`) go through ACP:

1. Add an `AcpProviderEntry` in `src/acp/provider-registry.ts` (launcher binary or `npx` package, optional `resolveEnv` / `authCheck`).
2. Extend `ProviderId` and any defaults in `src/types.ts` and `src/config/schema.ts` if the id is new.
3. Keep **`yardmaster providers doctor`** accurate by updating `src/providers/doctor-helpers.ts` / `default-checks.ts` with the CLI availability and auth checks users need for that provider.
4. Add help text in `src/cli/help/topics.ts` and update `src/cli/completion.ts`.

If a provider has an ACP launcher but no live doctor probe yet, land the ACP entry first and document the missing doctor coverage explicitly in the same change.

## Adding a new command

1. **Parse**: Add parser function in `src/cli/parse/` (prompt-commands or state-commands)
2. **Dispatch**: Add handler in `src/cli/dispatch/` (prompt-commands or state-commands)
3. **Help**: Add help topic in `src/cli/help/topics.ts` and register in `help.ts`
4. **Types**: Add `ParsedCommand` variant in `src/cli/types.ts`
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
- Update [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md) whenever provider checks, auth diagnostics, timeout behavior, or user-facing error next-steps change.
- Keep recovery commands aligned with current CLI help text and actual error messages from provider adapters and `error-format.ts`.

### Commits
- Use Conventional Commits format
- Examples: `feat(cli):`, `fix(providers):`, `refactor(config):`, `test(review):`
