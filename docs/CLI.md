# CLI Reference

> Complete command reference for genie v0.1.0.

## Quick reference

```bash
genie <prompt>                    # Shorthand for genie run
genie run [options] <prompt>      # Execute prompt with provider routing
genie design [options] <prompt>   # Frontend design feedback
genie commit [options]            # Generate commit message from staged diff
genie debug [options]             # Diagnose piped terminal errors
genie review [options]            # Code review with AI agents
genie update [options]            # Refresh local install
genie providers <subcommand>     # Provider inventory and diagnostics
genie config <subcommand>        # Configuration management
genie presets <subcommand>       # Preset management
genie completion <shell>          # Generate shell completions
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
