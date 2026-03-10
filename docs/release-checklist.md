# Genie CLI Release Checklist

Use this checklist before cutting a release tag for `genie`.

## 1) Pre-release checks

- [ ] Working tree is clean for release-intended files (`git status --short`).
- [ ] Fresh worktree dependencies are installed before verification (`cd genie && bun install --frozen-lockfile`).
- [ ] `README.md` usage, flags, exit codes, and examples match current CLI behavior.
- [ ] `genie --help` and subcommand help output are reviewed for regressions.
- [ ] Node/Bun runtime and lockfile are in expected state for reproducible builds.
- [ ] If using `bun link`, confirm the installed binary is reachable via `PATH` or invoke it via `$HOME/.bun/bin/genie`.

## 2) Command contract checks

- [ ] Legacy shorthand and explicit run command both work:
  - `genie "test prompt"`
  - `genie run "test prompt"`
- [ ] Root workflow help and topic help remain discoverable:
  - `genie --help`
  - `genie help run`
  - `genie help review`
- [ ] Machine-readable flows are stable:
  - `genie run --json "test prompt"`
  - `genie providers list --json`
  - `genie providers doctor --json`
  - `genie update --json --dry-run`
- [ ] JSON envelopes and schema output remain backward compatible, or the release
  explicitly documents an approved breaking change.
- [ ] Review JSON surfaces remain compatible:
  - `genie review --json-schema`
  - `genie review --all --base origin/main --json`
- [ ] Plain mode returns response text only:
  - `genie run --plain "test prompt"`
- [ ] Output channel contract holds:
  - stdout contains payload/machine data only.
  - stderr contains diagnostics/errors only.
- [ ] Non-interactive and quiet controls behave as documented:
  - `genie run --no-input --plain "test prompt"`
  - `genie config init --dry-run --quiet`

## 3) Exit-code checks

- [ ] `0` success path verified.
- [ ] `1` runtime/provider failure path verified.
- [ ] `2` invalid usage path verified.
- [ ] `3` auth/configuration failure path verified.
- [ ] `124` timeout path verified.

Suggested assertions:

```bash
set +e
genie run "ok prompt"; echo "exit=$?"
genie run --unknown-flag "bad"; echo "exit=$?"
genie run --provider codex "auth check prompt"; echo "exit=$?"
genie run --provider gemini --timeout-ms 1 "timeout check"; echo "exit=$?"
set -e
```

## 4) Provider diagnostics checks

- [ ] `genie providers list` shows all supported providers:
  - `claude`, `codex`, `cursor-agent`, `gemini`
- [ ] `genie providers doctor` reports availability/auth/latency details plus actionable hints when checks fail.
- [ ] `genie providers doctor --provider <id>` works for each provider.
- [ ] Doctor command does not hang and returns actionable hints on failure.
- [ ] Release notes or checklist explicitly call out optional provider gates:
  - `cursor-agent` is optional for release sign-off; verify it appears in provider inventory and doctor output, then document any auth/workspace-trust prerequisite that prevents a live smoke in the release directory.
  - If `genie providers doctor --provider cursor-agent --json` times out, open Cursor, confirm sign-in, and trust/approve the release worktree before retrying.

## 5) Verification commands (required)

Run from repository root:

```bash
cd genie
bun install --frozen-lockfile
bun run typecheck
bun run test
bun run build
bun run test:critical-path
```

Recommended smoke checks after build:

```bash
cd genie
bun link
$HOME/.bun/bin/genie --help
$HOME/.bun/bin/genie help run
$HOME/.bun/bin/genie run --provider codex --no-fallback --plain "release smoke test"
$HOME/.bun/bin/genie providers list --json
```

If the linked binary smoke fails, run `genie update --force` from `genie/` and retry the linked-binary checks before cutting the release.

## 6) Release sign-off criteria

- [ ] Typecheck passes.
- [ ] Test suite passes.
- [ ] Build passes.
- [ ] Smoke commands pass locally.
- [ ] Critical-path suite passes locally.
- [ ] Contract checks (commands/output/exit-codes/providers doctor) are complete.
- [ ] No open blocker defects for this release scope.
- [ ] Release approver confirms go/no-go in PR or release notes.

If any required check fails, block release until fixed or explicitly waived with owner + rationale.
