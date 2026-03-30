# CLI Reference

> Complete command reference for genie v0.1.0.

For failure recovery patterns (install/PATH fixes, provider auth and trust checks, timeout tuning, and output mode pitfalls), see [Troubleshooting](./TROUBLESHOOTING.md).

## Quick reference

```bash
genie <prompt>                    # Shorthand for genie run
genie run [options] <prompt>      # Execute prompt with provider routing
genie design [options] <prompt>   # Frontend design feedback
genie commit [options]            # Generate commit message from staged diff
genie debug [options]             # Diagnose piped terminal errors
genie review [options]            # Code review with AI agents
genie review --json-schema        # Print the review JSON Schema
genie update [options]            # Refresh local install
genie providers <subcommand>     # Provider inventory and diagnostics
genie config <subcommand>        # Configuration management
genie presets <subcommand>       # Preset management
genie completion <shell>          # Generate shell completions
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
genie help run
genie help design
genie help debug
genie help review
genie help config
genie help completion
```

---

## genie run

Execute a prompt with provider routing, config defaults, and fallback.

```bash
genie run [options] <prompt>
genie <prompt>                    # Shorthand
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
genie "summarize this repo"
genie run --provider codex --no-fallback "generate release notes"
genie run --preset headless-codex --json "list risky files"
genie run --prompt-file prompt.txt
cat prompt.txt | genie run --prompt-file -
genie run -p gemini -m gemini-2.0-flash "summarize this"
```

The global `--json`, `--plain`, `--quiet`, `--verbose`, `--no-color`, and `--no-input` flags also apply here.

---

## genie design

Get frontend design feedback and implementation-aware UI recommendations.

```bash
genie design [options] <prompt>
```

Accepts the same options as `genie run`. The prompt is wrapped with a design-focused system instruction before being sent to the provider.

### Examples

```bash
genie design "review the pricing page hierarchy and CTA emphasis"
genie design --provider codex --no-fallback "critique the dashboard empty state"
genie design --prompt-file brief.txt --json
```

---

## genie commit

Generate a Conventional Commits message from staged git changes.

```bash
genie commit [options]
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
genie commit                              # Print generated message
genie commit --apply                      # Commit with generated message
genie commit --apply --provider claude    # Use specific provider
```

`genie commit` reads `git diff --staged --no-color` from the selected workspace. It fails if there are no staged changes, `--workspace <path>` changes which repository is inspected before generating or applying the message, and `--json` is rejected for this command.

---

## genie debug

Read terminal error output and return a plain-language diagnosis.

```bash
genie debug [options]
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
npm test 2>&1 | genie debug
cat error.log | genie debug --provider claude --no-fallback
bun run build 2>&1 | genie debug --json
genie debug --input-file error.log --provider claude
```

When no `--input-file` is provided, `genie debug` expects piped input and rejects an interactive TTY with usage guidance.

---

## genie review

Review repository changes with one or more AI agents.

```bash
genie review [--all | --agent <id>] [--diff-file <path> | --staged | --base <ref>] [--json]
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
genie review --all
genie review --agent codex --staged
genie review --all --base origin/main
genie review --all --diff-file saved.patch --json
genie review --json-schema
```

---

## genie update

Refresh the local genie install by rebuilding and relinking.

```bash
genie update [--json] [--dry-run] [--force]
```

Runs: `bun run build` then `bun link`.

### Examples

```bash
genie update --dry-run    # Preview without changes
genie update --force      # Skip confirmation
```

---

## genie providers

Inspect provider inventory and diagnose availability/auth issues.

### Subcommands

```bash
genie providers list [--json]                   # List all providers
genie providers doctor [--provider <id>] [--json] # Health check
```

### Examples

```bash
genie providers list
genie providers list --json
genie providers doctor
genie providers doctor --provider codex --json
```

`--provider <id>` is only supported with `genie providers doctor`.

If provider checks fail or time out (especially `cursor-agent` trust/auth state), use the step-by-step fixes in [Troubleshooting](./TROUBLESHOOTING.md).

---

## genie config

Inspect and change persistent configuration defaults.

### Subcommands

```bash
genie config get [key] [--json]           # Read config value(s)
genie config set <key> <value> [--dry-run] # Set a config value
genie config init [--dry-run] [--force]   # Create default config file
genie config path [--json]                # Show config file path
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
genie config init
genie config get provider.default
genie config set provider.default codex --dry-run
genie config path
```

`genie config get` accepts zero or one key only. `genie config init` and `genie config path` reject extra positional arguments.

---

## genie presets

Save reusable execution defaults as named presets.

### Subcommands

```bash
genie presets list [--json]
genie presets get <name> [--json]
genie presets set <name> [options] [--dry-run] [--force]
genie presets delete <name> [--dry-run] [--force]
genie presets use <name> [--dry-run]
```

### Preset options (for `set`)

`--provider`, `--model`, `--mode`, `--trust`, `--yolo`, `--print`, `--include-directories`, `--output-format`, `--extensions`, `--mcp`, `--default`

### Examples

```bash
genie presets set headless-codex --provider codex --yolo --default --dry-run
genie presets list
genie presets get headless-codex
genie presets use headless-codex
genie presets delete headless-codex --force
genie run --preset headless-codex "summarize open todos"
```

The preset mutation flags (`--provider`, `--model`, `--mode`, `--output-format`, `--include-directories`, `--extensions`, `--mcp`, `--trust`, `--yolo`, `--print`, `--default`) are only valid with `genie presets set`, even when they appear before the subcommand token.

---

## genie completion

Generate shell completion scripts.

```bash
genie completion <bash|zsh|fish>
```

### Install

```bash
# bash
genie completion bash > ~/.local/share/bash-completion/completions/genie

# zsh
genie completion zsh > ~/.zfunc/_genie

# fish
genie completion fish > ~/.config/fish/completions/genie.fish
```

---

## JSON output notes

- Prompt commands (`run`, `design`, `debug`) use the response envelope documented in [API.md](API.md).
- State and mutation commands use stable envelopes with `kind`, `version`, `ok`, `exitCode`, and `error`.
- `genie review --json` emits the `review_result` envelope, and `genie review --json-schema` prints the matching JSON Schema.

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
  - `genie review --json`: `kind`, `version`, `mode`, `targets`, `source`, `cwd`, `git`, `diff`, `summary`, `results`, `exitCode`
- `--plain`: response text only.
- `--verbose`: extra execution diagnostics on stderr without changing stdout payloads.
- `--quiet`: suppresses confirmation-only success chatter such as `config init`.
- `--no-color` and `--no-input`: force non-interactive, no-color execution for child processes that respect `NO_COLOR`/`CI`.

---

## Configuration

### Paths

- User: `~/.config/genie/config.json`
- Project: `<repo>/.genie/config.json` (optional)

### Precedence

- `flags > env > project config > user config > defaults`

### Supported env vars

- `GENIE_PROVIDER`
- `GENIE_MODEL`
- `GENIE_MODE`
- `GENIE_WORKSPACE`
- `GENIE_TRUST`
- `GENIE_TIMEOUT_MS`
- `GENIE_OUTPUT`
- `GENIE_STRICT_COMMANDS`

### JSON output contract

When `--json` is used, commands emit a stable top-level envelope with:

- `kind`
- `version`
- `ok`
- `exitCode`
- `error`

Each command keeps its command-specific payload fields alongside that shared metadata. `genie review --json-schema` describes the `genie review --json` envelope.

---

## Provider prerequisites

- `claude`: installed and authenticated via Claude Code
- `codex`: installed and authenticated via `codex auth` or `~/.codex/auth.json`
- `gemini`: installed and authenticated via `GEMINI_API_KEY`
- `cursor-agent`: installed plus authenticated and trusted for the current workspace; if `genie providers doctor --provider cursor-agent --json` reports an auth failure, sign in through Cursor first; if it times out, open Cursor and trust/approve the current workspace for agent access before retrying

Use `genie providers doctor` for a quick health check before relying on any provider in automation or release smoke tests.

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
genie gleep

# opt back into the legacy single-token fallback
GENIE_STRICT_COMMANDS=0 genie gleep
```

---

## Examples

```bash
# shorthand prompt still works for actual prompt text
genie "explain recursion in one sentence"
genie explain recursion in one sentence

# explicit run command
genie run -p gemini -m gemini-2.0-flash "summarize this"

# file/stdin prompt input
genie run --prompt-file prompt.txt
cat prompt.txt | genie run --prompt-file -

# diagnose piped terminal output
npm test 2>&1 | genie debug
genie debug --input-file error.log

# generate a conventional commit message from staged changes
genie commit

# generate and apply the commit directly
genie commit --apply

# disable fallback for strict provider execution
genie run --provider codex --no-fallback "generate release notes"

# machine output
genie run --json "what changed in src/"

# provider diagnostics
genie providers doctor --json

# review with one or all coding agents
genie review --agent codex
genie review --all
genie review --all --diff-file original-agents.diff
genie review --all --staged
genie review --all --base origin/main
genie review --json-schema

# config workflows
genie config init --dry-run
genie config set provider.default codex --dry-run
genie config get provider.default
```
