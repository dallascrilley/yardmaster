# CLI Reference

> Complete command reference for yardmaster v0.2.0.

For failure recovery patterns (install/PATH fixes, provider auth and trust checks, timeout tuning, and output mode pitfalls), see [Troubleshooting](./TROUBLESHOOTING.md).

## Quick reference

```bash
yardmaster <prompt>                    # Shorthand for yardmaster run
yardmaster run [options] <prompt>      # Execute prompt with provider routing
yardmaster design [options] <prompt>   # Frontend design feedback
yardmaster commit [options]            # Generate commit message from staged diff
yardmaster debug [options]             # Diagnose piped terminal errors
yardmaster review [options]            # Code review with AI agents
yardmaster review --json-schema        # Print the review JSON Schema
yardmaster update [options]            # Refresh local install
yardmaster providers <subcommand>     # Provider inventory and diagnostics
yardmaster config <subcommand>        # Configuration management
yardmaster presets <subcommand>       # Preset management
yardmaster completion <shell>          # Generate shell completions
```

---

## Global flags

These flags are parsed before the subcommand and work across the CLI unless a command explicitly documents otherwise.

| Flag | Description |
|------|-------------|
| `-h, --help` | Show root or topic help |
| `--version` | Print the installed version |
| `--json` | Emit stable machine-readable JSON |
| `--plain` | Emit response text only |
| `--no-color` | Disable color output |
| `-q, --quiet` | Suppress confirmation-only success chatter |
| `-v, --verbose` | Emit extra diagnostics on stderr |
| `--no-input` | Force non-interactive mode for child processes that respect `CI` |

Task-oriented help is available for every major command:

```bash
yardmaster help run
yardmaster help design
yardmaster help debug
yardmaster help review
yardmaster help config
yardmaster help completion
```

---

## yardmaster run

Execute a prompt with provider routing, config defaults, and fallback.

```bash
yardmaster run [options] <prompt>
yardmaster <prompt>                    # Shorthand
```

### Options

| Flag | Description |
|------|-------------|
| `-p, --provider <id>` | Force provider: `claude`, `codex`, `cursor-agent`, `gemini` |
| `-m, --model <name>` | Override model for the selected provider |
| `-w, --workspace <path>` | Set working directory for the provider |
| `--mode <name>` | Execution mode: `default`, `read-only`, `danger-full-access`, `ask`, `plan`, `freeform` |
| `--trust` | Auto-trust provider responses |
| `--preset <name>` | Apply a saved preset |
| `--prompt-file <path\|->` | Read prompt from file or stdin (`-`) |
| `--yolo` | Skip safety confirmations |
| `--include-directories <a,b,c>` | Additional directories for provider context |
| `--output-format <text\|json\|stream-json>` | Provider output format |
| `--print` | Print-only mode (no interactive session) |
| `--extensions <a,b,c>` | Provider extensions to enable |
| `--mcp <a,b,c>` | MCP server configurations |
| `--timeout-ms <n>` | Per-provider timeout (max 300000) |
| `--no-fallback` | Disable fallback to other providers |

### Examples

```bash
yardmaster "summarize this repo"
yardmaster run --provider codex --no-fallback "generate release notes"
yardmaster run --preset headless-codex --json "list risky files"
yardmaster run --prompt-file prompt.txt
cat prompt.txt | yardmaster run --prompt-file -
yardmaster run -p gemini -m gemini-2.0-flash "summarize this"
```

The global `--json`, `--plain`, `--quiet`, `--verbose`, `--no-color`, and `--no-input` flags also apply here.

---

## yardmaster design

Get frontend design feedback and implementation-aware UI recommendations.

```bash
yardmaster design [options] <prompt>
```

Accepts the same options as `yardmaster run`. The prompt is wrapped with a design-focused system instruction before being sent to the provider.

### Examples

```bash
yardmaster design "review the pricing page hierarchy and CTA emphasis"
yardmaster design --provider codex --no-fallback "critique the dashboard empty state"
yardmaster design --prompt-file brief.txt --json
```

---

## yardmaster commit

Generate a Conventional Commits message from staged git changes.

```bash
yardmaster commit [options]
```

### Options

| Flag | Description |
|------|-------------|
| `-a, --apply` | Run `git commit -m "<message>"` immediately |
| `-p, --provider <id>` | Force provider |
| `-m, --model <name>` | Override model |
| `-w, --workspace <path>` | Working directory |
| `--mode <name>` | Execution mode |
| `--trust` | Auto-trust |
| `--preset <name>` | Apply preset |
| `--yolo` | Skip confirmations |
| `--timeout-ms <n>` | Timeout |
| `--no-fallback` | No fallback |

### Examples

```bash
yardmaster commit                              # Print generated message
yardmaster commit --apply                      # Commit with generated message
yardmaster commit --apply --provider claude    # Use specific provider
```

`yardmaster commit` reads `git diff --staged --no-color` from the selected workspace. It fails if there are no staged changes, `--workspace <path>` changes which repository is inspected before generating or applying the message, and `--json` is rejected for this command.

---

## yardmaster debug

Read terminal error output and return a plain-language diagnosis.

```bash
yardmaster debug [options]
```

Input is read from stdin or `--input-file`.

### Options

| Flag | Description |
|------|-------------|
| `--input-file <path\|->` | Read error output from file or stdin |
| `-p, --provider <id>` | Force provider |
| `-m, --model <name>` | Override model |
| `-w, --workspace <path>` | Working directory |
| `--mode <name>` | Execution mode |
| `--trust` | Auto-trust |
| `--preset <name>` | Apply preset |
| `--yolo` | Skip confirmations |
| `--timeout-ms <n>` | Timeout |
| `--no-fallback` | No fallback |

### Examples

```bash
npm test 2>&1 | yardmaster debug
cat error.log | yardmaster debug --provider claude --no-fallback
bun run build 2>&1 | yardmaster debug --json
yardmaster debug --input-file error.log --provider claude
```

When no `--input-file` is provided, `yardmaster debug` expects piped input and rejects an interactive TTY with usage guidance.

---

## yardmaster review

Review repository changes with one or more AI agents.

```bash
yardmaster review [--all | --agent <id>] [--diff-file <path> | --staged | --base <ref>] [--json]
```

### Options

| Flag | Description |
|------|-------------|
| `--all` | Run all review agents in parallel |
| `--agent <id>` | Run single agent: `codex`, `claude`, `gemini`, `cursor` |
| `--diff-file <path>` | Review a saved diff/patch file |
| `--staged` | Review staged changes only |
| `--base <ref>` | Review committed branch diff against a base ref |
| `--json` | Output structured JSON envelope |
| `--json-schema` | Print the JSON Schema for the review envelope |

One target is required: `--all` or `--agent <id>`.

### Diff source precedence

1. `--diff-file <path>` — read from file
2. `--staged` — `git diff --staged`
3. `--base <ref>` — `git diff <ref>..HEAD`
4. Default — `git diff HEAD`

### Validation rules

- Choose exactly one target: `--all` or `--agent <id>`.
- Choose at most one diff source: default diff, `--staged`, `--base <ref>`, or `--diff-file <path>`.
- `--json-schema` cannot be combined with review targets or diff-source flags.
- `--base` rejects empty or whitespace-only values.

### Examples

```bash
yardmaster review --all
yardmaster review --agent codex --staged
yardmaster review --all --base origin/main
yardmaster review --all --diff-file saved.patch --json
yardmaster review --json-schema
```

---

## yardmaster update

Refresh the local yardmaster install by rebuilding and relinking.

```bash
yardmaster update [--json] [--dry-run] [--force]
```

Runs: `bun run build` then `bun link`.

### Examples

```bash
yardmaster update --dry-run    # Preview without changes
yardmaster update --force      # Skip confirmation
```

---

## yardmaster providers

Inspect provider inventory and diagnose availability/auth issues.

### Subcommands

```bash
yardmaster providers list [--json]                   # List all providers
yardmaster providers doctor [--provider <id>] [--json] # Health check
```

### Examples

```bash
yardmaster providers list
yardmaster providers list --json
yardmaster providers doctor
yardmaster providers doctor --provider codex --json
```

`--provider <id>` is only supported with `yardmaster providers doctor`.

If provider checks fail or time out (especially `cursor-agent` trust/auth state), use the step-by-step fixes in [Troubleshooting](./TROUBLESHOOTING.md).

---

## yardmaster config

Inspect and change persistent configuration defaults.

### Subcommands

```bash
yardmaster config get [key] [--json]           # Read config value(s)
yardmaster config set <key> <value> [--dry-run] # Set a config value
yardmaster config init [--dry-run] [--force]   # Create default config file
yardmaster config path [--json]                # Show config file path
```

### Supported keys

| Key | Type | Default |
|-----|------|---------|
| `provider.default` | ProviderId | `claude` |
| `provider.fallbackOrder` | ProviderId[] | all providers |
| `model.byProvider` | Record | `{}` |
| `mode.default` | string | `default` |
| `workspace.last` | string | — |
| `output.default` | CliOutputMode | `auto` |
| `trust.default` | boolean | `false` |
| `runtime.timeoutMs` | number | `30000` |

### Examples

```bash
yardmaster config init
yardmaster config get provider.default
yardmaster config set provider.default codex --dry-run
yardmaster config path
```

`yardmaster config get` accepts zero or one key only. `yardmaster config init` and `yardmaster config path` reject extra positional arguments.

---

## yardmaster presets

Save reusable execution defaults as named presets.

### Subcommands

```bash
yardmaster presets list [--json]
yardmaster presets get <name> [--json]
yardmaster presets set <name> [options] [--dry-run] [--force]
yardmaster presets delete <name> [--dry-run] [--force]
yardmaster presets use <name> [--dry-run]
```

### Preset options (for `set`)

`--provider`, `--model`, `--mode`, `--trust`, `--yolo`, `--print`, `--include-directories`, `--output-format`, `--extensions`, `--mcp`, `--default`

### Examples

```bash
yardmaster presets set headless-codex --provider codex --yolo --default --dry-run
yardmaster presets list
yardmaster presets get headless-codex
yardmaster presets use headless-codex
yardmaster presets delete headless-codex --force
yardmaster run --preset headless-codex "summarize open todos"
```

The preset mutation flags (`--provider`, `--model`, `--mode`, `--output-format`, `--include-directories`, `--extensions`, `--mcp`, `--trust`, `--yolo`, `--print`, `--default`) are only valid with `yardmaster presets set`, even when they appear before the subcommand token.

---

## yardmaster completion

Generate shell completion scripts.

```bash
yardmaster completion <bash|zsh|fish>
```

### Install

```bash
# bash
yardmaster completion bash > ~/.local/share/bash-completion/completions/yardmaster

# zsh
yardmaster completion zsh > ~/.zfunc/_yardmaster

# fish
yardmaster completion fish > ~/.config/fish/completions/yardmaster.fish
```

---

## JSON output notes

- Prompt commands (`run`, `design`, `debug`) use the response envelope documented in [API.md](API.md).
- State and mutation commands use stable envelopes with `kind`, `version`, `ok`, `exitCode`, and `error`.
- `yardmaster review --json` emits the `review_result` envelope, and `yardmaster review --json-schema` prints the matching JSON Schema.

---

## Global flags

| Flag | Description |
|------|-------------|
| `-h, --help` | Show help |
| `--version` | Show version |
| `--json` | Structured JSON output |
| `--plain` | Plain text output only |
| `--no-color` | Disable color output |
| `-q, --quiet` | Suppress success chatter |
| `-v, --verbose` | Extra diagnostics on stderr |
| `--no-input` | Force non-interactive mode |

---

## Exit codes

- `0` success
- `1` runtime/provider failure
- `2` invalid usage
- `3` auth/configuration failure
- `124` timeout

---

## I/O contract

- stdout: response payload or machine output only.
- stderr: diagnostics, warnings, and errors only.
- `--json`: stable envelope:
  - `provider`, `model`, `response`, `fallbackUsed`, `timings`, `error`
  - `yardmaster review --json`: `kind`, `version`, `mode`, `targets`, `source`, `cwd`, `git`, `diff`, `summary`, `results`, `exitCode`
- `--plain`: response text only.
- `--verbose`: extra execution diagnostics on stderr without changing stdout payloads.
- `--quiet`: suppresses confirmation-only success chatter such as `config init`.
- `--no-color` and `--no-input`: force non-interactive, no-color execution for child processes that respect `NO_COLOR`/`CI`.

---

## Configuration

### Paths

- User: `~/.config/yardmaster/config.json`
- Project: `<repo>/.yardmaster/config.json` (optional)

### Precedence

- `flags > env > project config > user config > defaults`

### Supported env vars

- `YARDMASTER_PROVIDER`
- `YARDMASTER_MODEL`
- `YARDMASTER_MODE`
- `YARDMASTER_WORKSPACE`
- `YARDMASTER_TRUST`
- `YARDMASTER_TIMEOUT_MS`
- `YARDMASTER_OUTPUT`
- `YARDMASTER_STRICT_COMMANDS`

### JSON output contract

When `--json` is used, commands emit a stable top-level envelope with:

- `kind`
- `version`
- `ok`
- `exitCode`
- `error`

Each command keeps its command-specific payload fields alongside that shared metadata. `yardmaster review --json-schema` describes the `yardmaster review --json` envelope.

---

## Provider prerequisites

- `claude`: installed and authenticated via Claude Code
- `codex`: installed and authenticated via `codex auth` or `~/.codex/auth.json`
- `gemini`: installed and authenticated via `GEMINI_API_KEY`
- `cursor-agent`: installed plus authenticated and trusted for the current workspace; if `yardmaster providers doctor --provider cursor-agent --json` reports an auth failure, sign in through Cursor first; if it times out, open Cursor and trust/approve the current workspace for agent access before retrying

Use `yardmaster providers doctor` for a quick health check before relying on any provider in automation or release smoke tests.

---

## Advanced workflows

### Repo review workflows

From the repo root, the `justfile` wraps the most common local review flows:

```bash
just review-ready
just review-agent codex
just review-fast
just review-async-all
just review-status
just review-tail latest
```

Quick guide:

- `just review-ready`: check which reviewer paths are currently usable before starting a slower run
- `just review-agent codex`: run the strongest default single-reviewer path
- `just review-fast`: run a short bounded multi-reviewer sweep
- `just review-all`: run the full bounded multi-reviewer sweep
- `just review-async <reviewer>` / `just review-async-all`: launch background review runs
- `just review-status`: inspect async review run state
- `just review-tail latest`: inspect the latest async review output
- `just review-comment`: post generated review output as a PR comment
- `just review-submit approve|comment|request-changes`: submit a formal PR review

The review recipes use the source CLI entrypoint, resolve a portable timeout command, and surface real `gh` errors instead of collapsing them into a misleading "No open PR" message.

### Strict command mode

Strict command parsing is the default. Unknown bare root tokens now fail fast so typos do not silently turn into prompts.

```bash
# default behavior: usage error (exit 2)
yardmaster gleep

# opt back into the legacy single-token fallback
YARDMASTER_STRICT_COMMANDS=0 yardmaster gleep
```

---

## Examples

```bash
# shorthand prompt still works for actual prompt text
yardmaster "explain recursion in one sentence"
yardmaster explain recursion in one sentence

# explicit run command
yardmaster run -p gemini -m gemini-2.0-flash "summarize this"

# file/stdin prompt input
yardmaster run --prompt-file prompt.txt
cat prompt.txt | yardmaster run --prompt-file -

# diagnose piped terminal output
npm test 2>&1 | yardmaster debug
yardmaster debug --input-file error.log

# generate a conventional commit message from staged changes
yardmaster commit

# generate and apply the commit directly
yardmaster commit --apply

# disable fallback for strict provider execution
yardmaster run --provider codex --no-fallback "generate release notes"

# machine output
yardmaster run --json "what changed in src/"

# provider diagnostics
yardmaster providers doctor --json

# review with one or all coding agents
yardmaster review --agent codex
yardmaster review --all
yardmaster review --all --diff-file original-agents.diff
yardmaster review --all --staged
yardmaster review --all --base origin/main
yardmaster review --json-schema

# config workflows
yardmaster config init --dry-run
yardmaster config set provider.default codex --dry-run
yardmaster config get provider.default
```
