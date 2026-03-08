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

If `genie` is not found after `bun link`, add Bun's global bin directory to your shell `PATH`:

```bash
export PATH="$HOME/.bun/bin:$PATH"
```

Then verify the installed binary:

```bash
genie --help
genie providers list --json
```

Or use `npm link` / `pnpm link` after `bun run build`.

## Start here

```bash
genie "summarize the current branch"
npm test 2>&1 | genie debug
genie review --all
genie providers doctor
```

If you just run `genie`, the root command now shows workflow-oriented help with examples, command discovery, and suggested next commands.

## Verification

Run the full unattended critical-path suite locally from `genie/`:

```bash
bun run test:critical-path
```

That suite validates bootstrap commands, prompt flows, stateful commands, and the linked `genie` binary with isolated temp homes, mock providers, and temporary git workspaces.

## Command reference

```bash
genie <prompt>
genie run [options] <prompt>
genie design [options] <prompt>
genie commit [options]
genie debug [options]
genie review [--all | --agent <id>] [--diff-file <path> | --staged | --base <ref>] [--json]
genie review --json-schema
genie update [--json] [--dry-run] [--force]
genie providers list [--json]
genie providers doctor [--provider <id>] [--json]
genie config get [key] [--json]
genie config set <key> <value> [--dry-run]
genie config init [--dry-run] [--force]
genie config path [--json]
genie presets list [--json]
genie presets get <name> [--json]
genie presets set <name> [options] [--dry-run] [--force]
genie presets delete <name> [--dry-run] [--force]
genie presets use <name> [--dry-run]
genie completion <bash|zsh|fish>
```

Common next commands:

- `genie help run`
- `genie help design`
- `genie help review`
- `genie presets list`
- `genie config path`

Task-oriented terminal help is available for every major command:

```bash
genie help run
genie help design
genie help debug
genie help review
genie help config
genie help completion
```

Those help screens include examples, common flows, recovery guidance, and config/env precedence where relevant.

Input composition examples:

```bash
genie run --prompt-file prompt.txt
cat prompt.txt | genie run --prompt-file -
genie debug --input-file error.log
cat error.log | genie debug --input-file -
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
- `--prompt-file <path|->`
- `--yolo`
- `--include-directories <a,b,c>`
- `--output-format <text|json|stream-json>`
- `--print`
- `--extensions <a,b,c>`
- `--mcp <a,b,c>`
- `--timeout-ms <n>`
- `--no-fallback`

## Review flags

- `--all`
- `--agent <codex|claude|gemini|cursor>`
- `--diff-file <path>` (defaults to current `git diff`)
- `--staged` (review staged/index changes only)
- `--base <ref>` (review committed branch diff against explicit base, e.g. `origin/main`)
- `--json-schema` (print JSON Schema for `genie review --json` envelope)

## Repo review workflows

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

## Provider prerequisites

- `claude`: installed and authenticated via Claude Code
- `codex`: installed and authenticated via `codex auth` or `~/.codex/auth.json`
- `gemini`: installed and authenticated via `GEMINI_API_KEY`
- `cursor-agent`: installed plus authenticated and trusted for the current workspace; if `genie providers doctor --provider cursor-agent --json` times out, open Cursor, confirm sign-in, and trust/approve the current workspace for agent access before retrying

Use `genie providers doctor` for a quick health check before relying on any provider in automation or release smoke tests.

## Debug

`genie debug` reads terminal error output from stdin, sends the relevant failure context through the existing provider pipeline, and prints a plain-language diagnosis to stdout.

```bash
npm test 2>&1 | genie debug
cat error.log | genie debug --provider claude --no-fallback
genie debug --input-file error.log --provider claude
```

## Commit

`genie commit` reads `git diff --staged`, generates a Conventional Commits message, and prints it to stdout for review. Add `--apply` to run `git commit -m "<message>"` against the staged changes immediately.

```bash
genie commit
genie commit --apply --provider claude --no-fallback
```

## Update

Refreshes your local `genie` install in one command by running:

1. `bun run build`
2. `bun link`

```bash
genie update --dry-run
genie update --force
```

Safety controls for mutating commands:

- `--dry-run` previews `update`, `config set/init`, and `presets set/delete/use` without writing changes
- `--force` skips confirmation for destructive or overwriting operations such as `update`, `config init` over an existing file, `presets set` overwrite, and `presets delete`

Review output includes run context and per-agent metadata (`cwd`, `branch`, `head`, diff source, provider, model, latency, response chars).

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
- `GENIE_STRICT_COMMANDS`

### JSON output contract

When `--json` is used, commands emit a stable top-level envelope with:

- `kind`
- `version`
- `ok`
- `exitCode`
- `error`

Each command keeps its command-specific payload fields alongside that shared metadata. `genie review --json-schema` describes the `genie review --json` envelope.

### Strict command mode

Strict command parsing is the default. Unknown bare root tokens now fail fast so typos do not silently turn into prompts.

```bash
# default behavior: usage error (exit 2)
genie gleep

# opt back into the legacy single-token fallback
GENIE_STRICT_COMMANDS=0 genie gleep
```

## Presets

Use presets to preconfigure provider-specific execution flags so users do not have to remember each provider's syntax.

```bash
# create/update a preset
genie presets set headless-codex --provider codex --yolo --include-directories src,docs --output-format json --print --default --dry-run
genie presets set headless-codex --provider codex --yolo --include-directories src,docs --output-format json --print --default --force

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

## Shell completion

Generate completion scripts directly from the CLI:

```bash
genie completion bash > ~/.local/share/bash-completion/completions/genie
genie completion zsh > ~/.zfunc/_genie
genie completion fish > ~/.config/fish/completions/genie.fish
```

Install notes:

- `bash`: source the file or restart your shell after writing it into your bash completions directory
- `zsh`: add the target directory to `fpath` and run `autoload -U compinit && compinit` if needed
- `fish`: writing the file into `~/.config/fish/completions/` is enough for the next shell session

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

## Development

```bash
cd genie
bun run typecheck
bun run test
bun run build
```

Release checklist: `docs/release-checklist.md`
