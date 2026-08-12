# Troubleshooting

Operational fixes for common `yardmaster` failures in local and CI environments.

## Quick triage

Run a provider health check first:

```bash
yardmaster providers doctor
yardmaster providers list --json
```

Use targeted diagnostics when needed:

```bash
yardmaster providers doctor --provider codex --json
yardmaster providers doctor --provider cursor-agent --json
```

## Install and PATH issues

### `yardmaster: command not found` after install

Build and link again from `yardmaster/`:

```bash
bun install
bun run build
bun link
```

If the command is still missing, add Bun's global bin directory to your `PATH`:

```bash
export PATH="$HOME/.bun/bin:$PATH"
```

Verify:

```bash
yardmaster --help
```

### Provider binary missing on PATH

If doctor reports a provider as unavailable, install that provider CLI and confirm it resolves on `PATH`.

```bash
which claude
which codex
which gemini
which cursor-agent
```

Then rerun:

```bash
yardmaster providers doctor
```

## Provider authentication failures

### Codex auth failures

Common signals:
- `codex authentication not configured`
- `codex authentication check failed`

Recovery:

```bash
codex auth status
codex login
```

`yardmaster` also checks `~/.codex/auth.json`. If your Codex CLI does not support `auth status`, ensure a valid token exists there.

### Gemini auth failures

Common signal:
- `gemini authentication not configured`

Recovery:

```bash
export GEMINI_API_KEY="<your-key>"
yardmaster providers doctor --provider gemini --json
```

### Claude auth failures

If Claude provider checks fail, authenticate with the Claude CLI and retry doctor:

```bash
claude auth status
yardmaster providers doctor --provider claude --json
```

## Cursor Agent workspace trust and auth status timeouts

Common signals:
- `cursor-agent authentication check timed out`
- `cursor-agent authentication check failed`

Recovery sequence:
1. Open Cursor desktop app.
2. Confirm you are signed in.
3. Open the same repository/workspace and approve trust prompts.
4. Retry:

```bash
yardmaster providers doctor --provider cursor-agent --json
```

If checks still time out, restart Cursor and run the doctor command again.

## Gemini ACP (`yardmaster --provider gemini`)

Yardmaster runs **`gemini --acp`** for the ACP client path. If you see JSON-RPC parse failures, opaque protocol errors, or long hangs:

- Ensure **`GEMINI_API_KEY`** is set when using API-based auth.
- Upgrade **`gemini`** to a current release; older builds may disagree with the ACP handshake or **`protocolVersion`** expectations.
- Upstream issues: Gemini CLI has reported **stdout logging breaking NDJSON** and occasional **hangs** in `--acp` mode; see [google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli) ACP discussions. If logs corrupt the stream, you may see errors until the CLI routes noise to **stderr** only.

## Smoke tests (local and CI)

Optional real-LLM smoke: from `yardmaster/`, `bun run test:smoke` exercises `run` and `commit` across installed providers. It can run for a long time.

- Limit providers: `YARDMASTER_SMOKE_PROVIDERS=gemini` (comma-separated list). Unavailable providers are skipped using `yardmaster providers doctor` results.
- Shorter default: `bun run test:smoke:preflight` (Gemini-only filter).
- In **GitHub Actions**, workflow [`.github/workflows/smoke.yml`](../.github/workflows/smoke.yml) requires the **`GEMINI_API_KEY`** repository secret; scheduled runs and manual `workflow_dispatch` only.

## Timeout handling and slow providers

`yardmaster` returns exit code `124` when provider execution or checks time out.

Use a higher timeout for slow responses:

```bash
yardmaster run --timeout-ms 120000 "<prompt>"
```

Isolate one provider while debugging fallback chains:

```bash
yardmaster run --provider codex --no-fallback --timeout-ms 120000 "<prompt>"
```

## JSON vs plain output confusion

Use global output flags based on the consumer:
- `--json` for machine-readable envelopes
- `--plain` for response text only

Examples:

```bash
yardmaster run --json "summarize this repo"
yardmaster run --plain "summarize this repo"
```

Important behavior:
- `yardmaster commit` rejects `--json`.
- `yardmaster review --json-schema` cannot be combined with review target flags.
- `stdout` is payload output; diagnostics and hints are printed to `stderr`.

## Recovery commands reference

```bash
yardmaster help
yardmaster help run
yardmaster help review
yardmaster providers doctor
yardmaster providers list --json
```

If all providers fail, repair one provider end-to-end first, then rerun with `--provider <id> --no-fallback` to confirm a stable baseline.
