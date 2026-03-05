# genie

Unified AI CLI with deterministic provider routing, script-safe output, and robust non-hanging execution.

## Install

From the project root:

```bash
cd genie
bun install
bun run build
bun link
```

Or use `npm link` / `pnpm link` after `bun run build`.

## Usage

```bash
genie <prompt>
genie run [options] <prompt>
genie providers list [--json]
genie providers doctor [--provider <id>] [--json]
genie config get [key] [--json]
genie config set <key> <value>
genie config init
genie config path [--json]
genie presets list [--json]
genie presets get <name> [--json]
genie presets set <name> [options]
genie presets delete <name>
genie presets use <name>
```

## Global flags

- `-h, --help`
- `--version`
- `--json`
- `--plain`
- `--no-color`
- `-q, --quiet`
- `-v, --verbose`
- `--no-input`

## Run flags

- `-p, --provider <claude|codex|cursor-agent|gemini>`
- `-m, --model <name>`
- `-w, --workspace <path>`
- `--mode <name>`
- `--trust`
- `--preset <name>`
- `--yolo`
- `--include-directories <a,b,c>`
- `--output-format <text|json|stream-json>`
- `--print`
- `--extensions <a,b,c>`
- `--mcp <a,b,c>`
- `--timeout-ms <n>`
- `--no-fallback`

## I/O contract

- stdout: response payload or machine output only.
- stderr: diagnostics, warnings, and errors only.
- `--json`: stable envelope:
  - `provider`, `model`, `response`, `fallbackUsed`, `timings`, `error`
- `--plain`: response text only.

## Exit codes

- `0` success
- `1` runtime/provider failure
- `2` invalid usage
- `3` auth/configuration failure
- `124` timeout

## Config and precedence

Paths:

- User: `~/.config/genie/config.json`
- Project: `<repo>/.genie/config.json` (optional)

Precedence:

- `flags > env > project config > user config > defaults`

Supported env vars:

- `GENIE_PROVIDER`
- `GENIE_MODEL`
- `GENIE_MODE`
- `GENIE_WORKSPACE`
- `GENIE_TRUST`
- `GENIE_TIMEOUT_MS`
- `GENIE_OUTPUT`

## Presets

Use presets to preconfigure provider-specific execution flags so users do not have to remember each provider's syntax.

```bash
# create/update a preset
genie presets set headless-codex --provider codex --yolo --include-directories src,docs --output-format json --print --default

# inspect and list presets
genie presets get headless-codex
genie presets list --json

# run with preset
genie run --preset headless-codex "summarize open todos"
```

## Providers

Supported providers:

- `claude`
- `codex`
- `cursor-agent`
- `gemini`

Use `genie providers doctor` for availability/auth diagnostics and `genie providers list --json` for machine-readable provider inventory.

## Examples

```bash
# legacy shorthand still works
genie "explain recursion in one sentence"

# explicit run command
genie run -p gemini -m gemini-2.0-flash "summarize this"

# disable fallback for strict provider execution
genie run --provider codex --no-fallback "generate release notes"

# machine output
genie run --json "what changed in src/"

# provider diagnostics
genie providers doctor --json

# config workflows
genie config init
genie config set provider.default codex
genie config get provider.default
```

## Development

```bash
cd genie
bun run typecheck
bun run test
bun run build
```
