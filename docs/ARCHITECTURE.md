# Architecture

> Internal architecture reference for genie-cli v0.1.0.

## System overview

```
┌─────────────────────────────────────────────────────┐
│                     CLI Layer                       │
│  parse.ts → dispatch.ts → help.ts                   │
│  Tokenizes argv, routes to command handlers         │
└──────────────┬──────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────┐
│                  Execution Layer                    │
│  run-request.ts → normalize.ts → fallback.ts        │
│  Normalizes input, resolves provider order,         │
│  executes with fallback chain                       │
└──────────────┬──────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────┐
│                  Provider Layer                     │
│  registry.ts → base.ts → command-runner.ts          │
│  Adapter pattern: claude, codex, cursor-agent,      │
│  gemini — each maps args and parses output          │
└──────────────┬──────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────┐
│                  Config Layer                       │
│  schema.ts → store.ts                               │
│  Zod-validated config with 5-level precedence       │
│  flags > env > project > user > defaults            │
└─────────────────────────────────────────────────────┘
```

## Module map

```
genie/src/
├── index.ts                 # Entry point — delegates to cli()
├── cli.ts                   # Top-level orchestrator: parse → dispatch → exit
├── types.ts                 # Core types: ProviderId, RequestInput, NormalizedRequest, ProviderAdapter
├── errors.ts                # Error hierarchy: UsageError, RuntimeProviderError, AuthConfigurationError, TimeoutError, AggregatedProviderError
├── error-format.ts          # User-facing error formatting with next-step suggestions
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
│   ├── registry.ts          # providerAdapters array — all registered adapters
│   ├── base.ts              # createProviderAdapter() factory with shared logic
│   ├── command-runner.ts    # spawn-based command execution with timeout
│   ├── claude.ts            # Claude Code CLI adapter
│   ├── codex.ts             # Codex CLI adapter
│   ├── cursor-agent.ts      # Cursor Agent CLI adapter
│   ├── gemini.ts            # Gemini CLI adapter
│   ├── doctor.ts            # Provider health check (doctor) command
│   ├── doctor-types.ts      # Doctor result types
│   ├── doctor-helpers.ts    # Doctor utility functions
│   ├── default-checks.ts    # Default availability/auth check implementations
│   ├── codex-auth.ts        # Codex-specific auth detection
│   └── mapped-args/         # Provider-specific argument mapping
│       ├── shared.ts        # Shared arg mapping helpers
│       ├── claude.ts        # Claude flag mapping
│       ├── codex.ts         # Codex flag mapping
│       ├── cursor.ts        # Cursor flag mapping
│       └── gemini.ts        # Gemini flag mapping
│
├── execution/
│   ├── run-request.ts       # Top-level request executor
│   ├── normalize.ts         # RequestInput → NormalizedRequest
│   ├── request-schema.ts    # Zod schema for request validation
│   ├── fallback.ts          # executeWithFallback() — retry chain
│   ├── fallback-helpers.ts  # Fallback utility functions
│   ├── preflight.ts         # Provider availability + auth preflight checks
│   ├── provider-order.ts    # resolveProviderOrder() — config-aware ordering
│   ├── envelopes.ts         # Response envelope construction
│   ├── persist.ts           # Result persistence utilities
│   └── normalize.ts         # Request normalization logic
│
├── config/
│   ├── schema.ts            # GenieConfig Zod schema, defaults, mergeConfig()
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
5. normalizeRequest()
   │  Validate with Zod, apply config defaults, resolve workspace
   │  → NormalizedRequest (all fields required)
   │
6. resolveProviderOrder()
   │  Determine provider attempt sequence from config + explicit flag
   │  → ProviderId[] (e.g. ['codex', 'claude', 'gemini', 'cursor-agent'])
   │
7. executeWithFallback()
   │  For each provider in order:
   │  ├── runPreflight() → availability check + auth check
   │  ├── buildInvocation() → provider-specific CLI command
   │  ├── runCommand() → spawn with timeout handling
   │  └── parse() → extract response text
   │
8. Output
   ├── --json → GenieResponseEnvelope (structured)
   ├── --plain → response text only
   └── default → formatted response
```

## Provider adapter interface

Each provider implements `ProviderAdapter` from `types.ts`:

```typescript
interface ProviderAdapter {
  id: ProviderId
  isAvailable(runner?: CommandRunner): Promise<ProviderCheckResult>
  isAuthenticated(runner?: CommandRunner): Promise<ProviderCheckResult>
  buildInvocation(request: NormalizedRequest): ProviderInvocation
  execute(request: NormalizedRequest, runner?: CommandRunner): Promise<ProviderParseResult>
  parse(result: CommandResult): ProviderParseResult
}
```

Providers are created via `createProviderAdapter()` in `base.ts`, which wires shared logic (spawn, timeout, result parsing) and accepts optional custom availability/auth checks.

### Registered providers

| Provider | Binary | Auth method | Key flags |
|----------|--------|-------------|-----------|
| `claude` | `claude` | Claude Code auth | `--model`, `--permission-mode`, `--print`, `--add-dir`, `--mcp-config` |
| `codex` | `codex` | `codex auth` / `~/.codex/auth.json` | `exec`, `--model`, `--sandbox` |
| `cursor-agent` | `cursor-agent` | `cursor-agent auth status` | Workspace trust required |
| `gemini` | `gemini` | `GEMINI_API_KEY` env var | `--extensions`, `-p` |

## Config system

**Schema** (Zod-validated in `config/schema.ts`):

```
GenieConfig
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
2. Environment variables (`GENIE_PROVIDER`, `GENIE_MODEL`, etc.)
3. Project config (`.genie/config.json`)
4. User config (`~/.config/genie/config.json`)
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

The review system runs code review through one or more AI providers in parallel:

```
genie review [--all | --agent <id>] [--diff-file | --staged | --base <ref>]
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
              (each agent → mapped provider → spawn → parse)
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
| Adapter | `ProviderAdapter` interface + 4 implementations | Uniform provider API |
| Factory | `createProviderAdapter()` | Shared adapter construction |
| Discriminated Union | `ParsedCommand` variants | Type-safe command dispatch |
| Chain of Responsibility | Config loading from 5 sources | Precedence-based merging |
| Strategy | Provider selection at runtime | Swappable AI backends |
| Fallback/Retry | `executeWithFallback()` | Fault-tolerant execution |

## Extension points

1. **New provider**: Create adapter in `providers/`, add to registry, add mapped-args module
2. **New command**: Add parser in `cli/parse/`, dispatcher in `cli/dispatch/`, help in `cli/help/topics.ts`
3. **Config option**: Extend Zod schema in `config/schema.ts`, add loading in `config/store.ts`
4. **New error type**: Create in `errors.ts`, add exit code mapping, add formatting in `error-format.ts`
