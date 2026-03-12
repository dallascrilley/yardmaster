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

## Project structure

```
genie-cli/
├── genie/                  # Main package
│   ├── src/                # TypeScript source
│   │   ├── cli/            # Parsing and dispatch
│   │   ├── providers/      # Provider adapters
│   │   ├── execution/      # Request pipeline
│   │   ├── config/         # Configuration
│   │   ├── review/         # Code review system
│   │   ├── commit/         # Commit message generation
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

1. Create `genie/src/providers/<name>.ts`:
   - Export a `ProviderAdapter` using `createProviderAdapter()` from `base.ts`
   - Implement custom `availabilityCheck` and `authCheck` if needed
   - The factory handles shared logic (spawn, timeout, parsing)

2. Create `genie/src/providers/mapped-args/<name>.ts`:
   - Export an `apply<Name>MappedArgs()` function
   - Map `NormalizedRequest` fields to provider-specific CLI flags

3. Register in `genie/src/providers/registry.ts`:
   - Import and add the adapter to the `providerAdapters` array

4. Add the provider ID to `providerIds` in `genie/src/types.ts`

5. Add help text in `genie/src/cli/help/topics.ts`

6. Update shell completions in `genie/src/cli/completion.ts`

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
