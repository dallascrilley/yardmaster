# Genie CLI Release Checklist

Use this checklist before cutting a release tag for `genie`.

## 1) Pre-release checks

- [ ] Working tree is clean for release-intended files (`git status --short`).
- [ ] `README.md` usage, flags, exit codes, and examples match current CLI behavior.
- [ ] `genie --help` and subcommand help output are reviewed for regressions.
- [ ] Node/Bun runtime and lockfile are in expected state for reproducible builds.

## 2) Command contract checks

- [ ] Legacy shorthand and explicit run command both work:
  - `genie "test prompt"`
  - `genie run "test prompt"`
- [ ] Machine-readable flows are stable:
  - `genie run --json "test prompt"`
  - `genie providers list --json`
  - `genie providers doctor --json`
- [ ] Plain mode returns response text only:
  - `genie run --plain "test prompt"`
- [ ] Output channel contract holds:
  - stdout contains payload/machine data only.
  - stderr contains diagnostics/errors only.

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
- [ ] `genie providers doctor` reports availability/auth/version/latency details.
- [ ] `genie providers doctor --provider <id>` works for each provider.
- [ ] Doctor command does not hang and returns actionable hints on failure.

## 5) Verification commands (required)

Run from repository root:

```bash
cd genie
bun run typecheck
bun run test
bun run build
```

Recommended smoke checks after build:

```bash
cd genie
bun link
genie --help
genie run --plain "release smoke test"
genie providers list --json
```

## 6) Release sign-off criteria

- [ ] Typecheck passes.
- [ ] Test suite passes.
- [ ] Build passes.
- [ ] Smoke commands pass locally.
- [ ] Contract checks (commands/output/exit-codes/providers doctor) are complete.
- [ ] No open blocker defects for this release scope.
- [ ] Release approver confirms go/no-go in PR or release notes.

If any required check fails, block release until fixed or explicitly waived with owner + rationale.
