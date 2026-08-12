# Security

## Reporting a vulnerability

Please report security issues privately through
[GitHub Security Advisories](https://github.com/dallascrilley/yardmaster/security/advisories/new)
rather than a public issue. Include the version or commit, the commands you
ran, and what you observed. I aim to acknowledge within a week.

## What this tool touches

Yardmaster launches provider CLIs as subprocesses over
[Agent Client Protocol](https://agentclientprotocol.com) and relays their
sessions. That means a few things are worth knowing.

- **Credentials stay with the provider CLI.** Yardmaster does not read, store,
  or forward provider API keys. It shells out to `claude`, `codex`, `agent`, or
  `gemini` and relies on whatever login those tools already have. The one
  exception is `providers doctor`, which reads `~/.codex/auth.json` to check
  whether a credential exists when the Codex CLI exposes no working auth probe;
  it reports presence only and never the token value.
- **Diagnostics redact operator identity by default.** Provider CLIs print the
  signed-in account: `claude auth status` returns `email`, `orgId`, and
  `orgName`. `providers doctor` replaces those values and sets
  `identityRedacted: true`. `--show-identity` prints them unredacted; treat
  that output as sensitive.
- **Filesystem access is workspace-scoped.** ACP host handlers resolve read and
  write requests against the resolved workspace root and reject paths that
  escape it (`src/acp/host-handlers.ts`).
- **`--trust` and `--yolo` lower the guardrails.** They hand broader permission
  to the underlying agent. Do not use them on untrusted repositories or
  untrusted prompt input.
- **Prompts are attacker-controlled input.** Text from a diff, a test log piped
  into `yardmaster debug`, or a file passed with `--prompt-file` reaches a model
  that may act on it. Review what you pipe in.

## Supported versions

This is a personal project without a release cadence. Fixes land on `main`.
