# Yardmaster

**Yardmaster — one CLI that routes any prompt to Claude, Codex, Cursor, or Gemini, with JSON output and real exit codes.**

[![CI](https://github.com/dallascrilley/yardmaster/actions/workflows/ci.yml/badge.svg)](https://github.com/dallascrilley/yardmaster/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6.svg)](https://www.typescriptlang.org/)

I kept writing the same shell glue: check which agent CLI is installed, check
whether it is logged in, run the prompt, parse whatever it printed, guess from
the text whether it failed. Yardmaster is that glue turned into one command
with a stable contract. Every provider speaks
[Agent Client Protocol](https://agentclientprotocol.com), every command answers
`--json` with the same envelope, and every failure mode has its own exit code
so a script can branch on it.

## See it

`providers doctor` answers the question that breaks automation first: which
agent CLIs are on this machine, and are they usable right now.

```console
$ yardmaster providers doctor --json
{
  "providers": [
    {
      "provider": "claude",
      "available": true,
      "authenticated": true,
      "availabilityDetails": "2.1.228 (Claude Code)",
      "authDetails": "{\n  \"loggedIn\": true,\n  \"authMethod\": \"claude.ai\",\n  \"apiProvider\": \"firstParty\",\n  \"email\": \"[redacted]\",\n  \"orgId\": \"[redacted]\",\n  \"orgName\": \"[redacted]\",\n  \"subscriptionType\": \"max\"\n}",
      "identityRedacted": true,
      "latencyMs": 379
    },
    {
      "provider": "codex",
      "available": true,
      "authenticated": true,
      "availabilityDetails": "codex-cli 0.147.0",
      "authDetails": "Logged in using ChatGPT",
      "identityRedacted": true,
      "latencyMs": 40
    },
    {
      "provider": "gemini",
      "available": false,
      "authenticated": false,
      "availabilityDetails": "Unable to execute gemini --version",
      "hint": "spawn gemini ENOENT",
      "identityRedacted": true,
      "latencyMs": 5
    }
  ],
  "kind": "providers_doctor",
  "version": 1,
  "ok": true,
  "exitCode": 0,
  "error": null
}
```

Failures use the same envelope and set the exit code to match:

```console
$ yardmaster run --provider gemini --no-fallback --json "hi"
{
  "kind": "error",
  "version": 1,
  "ok": false,
  "exitCode": 3,
  "error": {
    "code": "3",
    "message": "All providers failed. Enable a configured provider and try again.\n- gemini (auth): Auth check failed for gemini\n\nNext steps:\n- Run `yardmaster providers doctor` to check installation and authentication state.\n- Retry with `yardmaster run --provider <id> --no-fallback \"<prompt>\"` once one provider is healthy."
  }
}
$ echo $?
3
```

## Quickstart

Requires [Bun](https://bun.sh) to install, build, and test, and Node.js to run
the built binary. CI runs Bun 1.3.14. You also need at least one provider CLI
on `PATH`: `claude`, `codex`, `agent` (Cursor), or `gemini`.

```bash
git clone https://github.com/dallascrilley/yardmaster.git
cd yardmaster
bun install
bun run build
bun link
```

If the command is not found afterwards, add Bun's global bin directory to your
`PATH`:

```bash
export PATH="$HOME/.bun/bin:$PATH"
```

Then:

```bash
yardmaster --help
yardmaster providers doctor
yardmaster "summarize the current branch"
npm test 2>&1 | yardmaster debug
yardmaster review --all
```

## The three decisions

**Exit codes are part of the contract.** A caller never has to grep stderr to
find out what went wrong. Bad input is 2, an auth or configuration problem is
3, a timeout is 124, and a provider that ran but failed is 1. The mapping lives
in [`src/errors.ts`](src/errors.ts) and is asserted end to end against the real
binary in [`test/cli.exit-codes.integration.test.ts`](test/cli.exit-codes.integration.test.ts).

**Diagnostics do not leak the operator.** `claude auth status` answers with
JSON carrying `email`, `orgId`, and `orgName`, so a doctor report pasted into
an issue used to carry the author's account with it. Detail fields now pass
through [`src/providers/redact.ts`](src/providers/redact.ts), which keeps the
payload's shape and its useful fields and replaces the identity-bearing ones.
`identityRedacted` says so in the output, and `--show-identity` opts back in.

**One protocol instead of four adapters.** Providers are reached over Agent
Client Protocol rather than a bespoke wrapper per vendor, so sessions, streamed
output, permission prompts, and filesystem access follow one code path in
[`src/acp/`](src/acp). Adding a provider is a registry entry in
[`src/acp/provider-registry.ts`](src/acp/provider-registry.ts), not a new
adapter.

## Honest boundaries

- **Not on npm.** There is no published package and no release binary. Install
  from source with the quickstart above. The `bin` name is `yardmaster`; there
  is no short alias.
- **Version-tolerant, not version-proof.** Vendor CLIs move. `codex auth
  status` was removed in codex-cli 0.147.0, which is why the codex probe tries
  `codex login status` first, falls back to the older spelling, then to
  `~/.codex/auth.json`, and finally reports an explicit unsupported-version
  result. A CLI that changes its interface again will land in that last branch
  until the probe is updated.
- **Provider prerequisites are real.** Cursor needs the `agent` binary on
  `PATH` or `YARDMASTER_CURSOR_ACP_BIN` set, and Gemini needs a `gemini` build
  that supports `--acp`. `providers doctor` reports both.
- **`pi` is an alias, not a provider.** It resolves to a configured backend via
  `YARDMASTER_PI_BACKEND`; it has no doctor probe of its own.
- **Smoke tests call real models.** The 260 tests in CI are hermetic. The
  separate `bun run test:smoke` suite spends real tokens and is not part of the
  gate.

## Global flags

- `-h, --help`: show help
- `--version`: show version
- `--json`: structured JSON output
- `--plain`: plain text output only
- `--no-color`: disable color output
- `-q, --quiet`: suppress success chatter
- `-v, --verbose`: extra diagnostics on stderr
- `--no-input`: force non-interactive mode

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | success |
| `1` | provider ran and failed |
| `2` | invalid usage |
| `3` | auth or configuration failure |
| `124` | timeout |

## Documentation

| Document | Description |
|----------|-------------|
| [CLI reference](docs/CLI.md) | Every command and flag, with examples |
| [Architecture](docs/ARCHITECTURE.md) | Module map, request lifecycle, ACP design |
| [API reference](docs/API.md) | TypeScript types and JSON contracts |
| [Troubleshooting](docs/TROUBLESHOOTING.md) | Install, auth, timeout, and output-mode fixes |
| [Contributing](CONTRIBUTING.md) | Setup, conventions, extension guides |
| [Security](SECURITY.md) | Reporting a vulnerability |

## Development

```bash
bun install
bun run validate   # typecheck, test, build, critical-path suite
```

`bun run validate` runs exactly what [CI](.github/workflows/ci.yml) runs.

## License

MIT. See [LICENSE](LICENSE).
