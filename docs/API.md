# API Reference

> TypeScript types, interfaces, and JSON contracts for genie-cli v0.2.0.

## Core types

### ProviderId

```typescript
type ProviderId = 'claude' | 'codex' | 'cursor-agent' | 'gemini'
```

### ModeId

```typescript
type ModeId = 'default' | 'read-only' | 'danger-full-access' | 'ask' | 'plan' | 'freeform'
```

### CliOutputMode

```typescript
type CliOutputMode = 'auto' | 'pretty' | 'json' | 'plain'
```

### ProviderOutputFormat

```typescript
type ProviderOutputFormat = 'text' | 'json' | 'stream-json'
```

---

## Request types

### RequestInput

Sparse input from CLI flags — most fields optional.

```typescript
type RequestInput = {
  prompt: string
  provider?: string
  model?: string
  workspace?: string
  mode?: string
  trust?: boolean
  output?: CliOutputMode
  timeoutMs?: number
  noFallback?: boolean
  yolo?: boolean
  includeDirectories?: string[]
  outputFormat?: ProviderOutputFormat
  headless?: boolean
  extensions?: string[]
  mcp?: string[]
}
```

### NormalizedRequest

Fully resolved request — all fields have values after config merge.

```typescript
type NormalizedRequest = {
  prompt: string
  provider?: ProviderId
  model?: string
  workspace: string           // Required — from config or cwd
  mode: string                // Required — from config default
  trust: boolean              // Required — from config default
  output: CliOutputMode
  timeoutMs: number           // Default: 30000
  noFallback: boolean
  yolo: boolean
  includeDirectories: string[]
  outputFormat: ProviderOutputFormat
  headless: boolean
  extensions: string[]
  mcp: string[]
}
```

---

## Provider types

### ProviderAdapter

The interface every provider implements.

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

### ProviderInvocation

The CLI command to spawn for a provider.

```typescript
type ProviderInvocation = {
  command: string       // e.g. 'claude', 'codex'
  args: string[]        // CLI arguments
  cwd?: string          // Working directory
  timeoutMs?: number    // Per-invocation timeout
}
```

### CommandResult

Raw output from a spawned provider process.

```typescript
type CommandResult = {
  stdout: string
  stderr: string
  code: number         // 0 = success, 124 = timeout, 127 = spawn/cwd ENOENT, 128+N = signal exit
}
```

When `code` is `127`, inspect `stderr` to distinguish a missing binary from an invalid working directory.

### CommandRunner

Injectable function for spawning provider commands (enables testing).

```typescript
type CommandRunner = (invocation: ProviderInvocation) => Promise<CommandResult>
```

### ProviderCheckResult

Result of an availability or auth check.

```typescript
type ProviderCheckResult =
  | { ok: true; details?: string }
  | {
      ok: false
      reason: string
      hint?: string
      code?: number
      details?: string
      authFailure?: boolean
      timeout?: boolean
    }
```

### ProviderParseResult

Parsed response from a provider.

```typescript
type ProviderParseResult = {
  text: string
  raw: CommandResult
}
```

---

## Result types

### CliJsonSuccessEnvelope

Stable success envelope used by stateful commands such as `config`, `presets`, `providers`, and `update`.

```typescript
type CliJsonSuccessEnvelope<T extends Record<string, unknown>> = T & {
  kind: string
  version: 1
  ok: boolean
  exitCode: number
  error: null
}
```

### CliJsonErrorEnvelope

Stable top-level error envelope returned when `--json` is requested and the command fails before producing a feature-specific payload.

```typescript
type CliJsonErrorEnvelope = {
  kind: 'error'
  version: 1
  ok: false
  exitCode: number
  error: {
    code: string
    message: string
  }
}
```

### GenieRunResult

Complete result of a prompt execution.

```typescript
type GenieRunResult = {
  provider: ProviderId
  model: string | undefined
  mode: string
  workspace: string
  trust: boolean
  response: string
  raw: CommandResult
  fallbackUsed: boolean
  timings: {
    totalMs: number
    attempts: Array<{
      provider: ProviderId
      stage: ProviderFailureStage | 'success'
      durationMs: number
      ok: boolean
      reason?: string
    }>
  }
}
```

### GenieResponseEnvelope

JSON output envelope for `--json` mode.

```typescript
type GenieResponseEnvelope = {
  provider: ProviderId | null
  model: string | null
  response: string
  fallbackUsed: boolean
  timings: {
    totalMs: number
    attempts: Array<{
      provider: ProviderId
      stage: ProviderFailureStage | 'success'
      durationMs: number
      ok: boolean
      reason?: string
    }>
  }
  error: {
    code: string
    message: string
  } | null
}
```

`GenieResponseEnvelope` is the payload wrapped inside the prompt-command JSON success envelopes. `genie run`, `genie design`, and `genie debug` emit `CliJsonSuccessEnvelope<GenieResponseEnvelope>` with command-specific `kind` values such as `run_result`, `design_result`, and `debug_result`. If the CLI fails before a prompt result exists and `--json` was requested, it emits `CliJsonErrorEnvelope` instead.

---

## Failure types

### ProviderFailureStage

```typescript
type ProviderFailureStage = 'availability' | 'auth' | 'execution'
```

### ProviderFailureReason

Detailed failure record for a single provider attempt.

```typescript
type ProviderFailureReason = {
  provider: ProviderId
  stage: ProviderFailureStage
  reason: string
  hint?: string
  durationMs?: number
  authFailure?: boolean
  timeout?: boolean
}
```

---

## Config types

### GenieConfig

Full configuration schema (Zod-validated).

```typescript
type GenieConfig = {
  provider: {
    default: ProviderId                   // Default: 'claude'
    fallbackOrder: ProviderId[]           // Default: all providers
  }
  model: {
    byProvider: Record<string, string>    // Per-provider model overrides
  }
  mode: {
    default: string                       // Default: 'default'
  }
  workspace: {
    last?: string
  }
  output: {
    default: CliOutputMode                // Default: 'auto'
  }
  trust: {
    default: boolean                      // Default: false
  }
  runtime: {
    timeoutMs: number                     // Default: 30000, max: 300000
  }
  presets: {
    default?: string
    named: Record<string, ProviderPreset>
  }
}
```

### ProviderPreset

Saved execution defaults.

```typescript
type ProviderPreset = {
  provider?: ProviderId
  model?: string
  mode?: string
  trust?: boolean
  yolo?: boolean
  headless?: boolean
  includeDirectories?: string[]
  outputFormat?: ProviderOutputFormat
  extensions?: string[]
  mcp?: string[]
}
```

---

## Review types

### ReviewAgentId

```typescript
type ReviewAgentId = 'codex' | 'claude' | 'gemini' | 'cursor'
```

### ReviewDiffStats

```typescript
type ReviewDiffStats = {
  files: number
  additions: number
  deletions: number
}
```

### ReviewProviderResult

Result from a single review agent.

```typescript
type ReviewProviderResult = {
  agent: ReviewAgentId
  provider: ProviderId
  model: string | null
  status: 'ok' | 'error'
  latencyMs: number
  responseChars: number
  review: string
}
```

### ReviewExecutionResult

Aggregated result from a review run.

```typescript
type ReviewExecutionResult = {
  mode: 'single' | 'all'
  agents: ReviewAgentId[]
  source: string
  cwd: string
  git: { branch: string | null; head: string | null }
  diff: ReviewDiffStats
  results: ReviewProviderResult[]
  summary: { total: number; succeeded: number; failed: number }
  exitCode: 0 | 1
}
```

### ReviewJsonEnvelope

JSON output for `genie review --json`.

```typescript
type ReviewJsonEnvelope = {
  kind: 'review_result'
  version: 1
  ok: boolean
  mode: 'single' | 'all'
  targets: ReviewAgentId[]
  source: string
  cwd: string
  git: { branch: string | null; head: string | null }
  diff: ReviewDiffStats
  summary: { total: number; succeeded: number; failed: number }
  results: ReviewProviderResult[]
  exitCode: 0 | 1
  error: null
}
```

Use `genie review --json-schema` to get the full JSON Schema for this envelope.

`targets` is the requested review-agent set. Per-agent execution outcomes appear in `results`.

---

## Error classes

| Class | Exit code | When |
|-------|-----------|------|
| `UsageError` | 2 | Invalid arguments or unknown commands |
| `AuthConfigurationError` | 3 | Provider auth not configured |
| `TimeoutError` | 124 | Provider timed out |
| `RuntimeProviderError` | 1 | Provider execution failed |
| `AggregatedProviderError` | 1/3/124 | All providers failed (exit code depends on failure types) |

---

## Environment variables

| Variable | Description | Maps to |
|----------|-------------|---------|
| `GENIE_PROVIDER` | Default provider | `config.provider.default` |
| `GENIE_MODEL` | Default model | `config.model.byProvider[provider]` |
| `GENIE_MODE` | Default mode | `config.mode.default` |
| `GENIE_WORKSPACE` | Workspace path | `config.workspace.last` |
| `GENIE_TRUST` | Trust responses (0/1) | `config.trust.default` |
| `GENIE_TIMEOUT_MS` | Timeout in ms | `config.runtime.timeoutMs` |
| `GENIE_OUTPUT` | Output mode | `config.output.default` |
| `GENIE_STRICT_COMMANDS` | Strict command parsing (0/1) | Fail on unknown root tokens |

---

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Runtime/provider failure |
| `2` | Invalid usage |
| `3` | Auth/configuration failure |
| `124` | Timeout |
