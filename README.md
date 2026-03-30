# genie

Unified AI CLI with deterministic provider routing, script-safe output, and robust non-hanging execution.

## Documentation

| Document | Description |
|----------|-------------|
| [CLI Reference](docs/CLI.md) | Complete command reference with all flags and examples |
| [Architecture](docs/ARCHITECTURE.md) | System design, module map, request lifecycle, patterns |
| [API Reference](docs/API.md) | TypeScript types, interfaces, and JSON contracts |
| [Contributing](docs/CONTRIBUTING.md) | Development setup, conventions, extension guides |
| [Troubleshooting](docs/TROUBLESHOOTING.md) | Operational fixes for install, auth, timeouts, and output modes |
| [Release Checklist](docs/release-checklist.md) | Pre-release verification steps |

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

## Global flags

- `-h, --help`: Show help
- `--version`: Show version
- `--json`: Structured JSON output
- `--plain`: Plain text output only
- `--no-color`: Disable color output
- `-q, --quiet`: Suppress success chatter
- `-v, --verbose`: Extra diagnostics on stderr
- `--no-input`: Force non-interactive mode

## Exit codes

- `0` success
- `1` runtime/provider failure
- `2` invalid usage
- `3` auth/configuration failure
- `124` timeout

## Development

See [Contributing](docs/CONTRIBUTING.md) for development guidelines and extension guides.

```bash
cd genie
bun run typecheck
bun run test
bun run build
```
