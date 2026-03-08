# Release Readiness Sweep

**Date:** 2026-03-06
**Scope:** `genie` CLI release readiness and release-hygiene follow-up
**Branch Tip Verified:** `bd9b057` (`chore(release): tighten readiness verification`)
**Status:** Released as `v0.1.0` on `main`; `cursor-agent` remains an optional provider gate

## Worktree Hygiene Inventory

Initial local inventory before cleanup decisions:

- Current docs branch (`chore/release-readiness-doc-reconcile`):
  - Tracked edits: `README.md`, `docs/plans/2026-03-05-review-command-implementation.md`,
    `docs/release-checklist.md`, `docs/todo.md`
  - Untracked: `error.log`
  - Classification:
    - `error.log`: do not commit; move out of tree or ignore locally after review
- Main worktree (`/Users/dallascrilley/Code/cli-projects/genie-cli`):
  - Untracked: `.codex/`, `.gemini/`, `error.log`, `genie/error.log`
  - Classification:
    - `.codex/`, `.gemini/`: do not commit; move out of the repo root
    - `error.log`, `genie/error.log`: local artifacts; do not commit

Release verification was executed from a fresh temporary worktree created from commit `bd9b057`.
The clean-worktree gate was verified with:

- `git status --short` -> exit `0`, no output

## Policy Decisions

### 1) `cursor-agent` release policy

Decision: `cursor-agent` is **optional-but-documented** for release sign-off.

- Required for sign-off:
  - `genie providers list --json` includes `cursor-agent`
  - `genie providers doctor --provider cursor-agent --json` returns actionable output
  - Release notes/checklist document auth and workspace-trust prerequisites
- Waived from sign-off in this environment:
  - Live `cursor-agent` smoke execution in a fresh release worktree
- Owner: release approver
- Rationale: the remaining failure is environment-local workspace trust/auth, not a packaging or CLI contract defect

### 2) Install-path reliability

Decision: keep `bun link` as the supported install path and document `$HOME/.bun/bin/genie`
as the explicit fallback.

- Verified in this zsh environment:
  - `bun link` -> exit `0`
  - `command -v genie` -> `/Users/dallascrilley/.bun/bin/genie`
- Documentation outcome:
  - `README.md` keeps the `PATH` fallback guidance
  - `docs/release-checklist.md` now requires `bun install --frozen-lockfile` in a fresh worktree
  - `docs/release-checklist.md` keeps `$HOME/.bun/bin/genie` as the explicit fallback smoke path

### 3) Clean-worktree prerequisite

The first clean-worktree attempt failed before verification because the checklist skipped dependency
installation. In a truly fresh worktree:

- `bun run typecheck` failed with missing Node type definitions
- `bun test` failed because `zod` was not installed
- linked-binary smoke failed because runtime dependencies were missing from `node_modules`

The release checklist was corrected to require:

- `cd genie && bun install --frozen-lockfile`

## Branch-Tip Verification

Worktree: `/tmp/genie-release-branch.boKJb2`

### Build and test

- `cd /tmp/genie-release-branch.boKJb2/genie && bun install --frozen-lockfile` -> exit `0`
- `cd /tmp/genie-release-branch.boKJb2/genie && bun run typecheck` -> exit `0`
- `cd /tmp/genie-release-branch.boKJb2/genie && bun test` -> exit `0` (`136` passing, `0` failing)
- `cd /tmp/genie-release-branch.boKJb2/genie && bun run build` -> exit `0`

### Installed-binary and command-contract smoke

- `cd /tmp/genie-release-branch.boKJb2/genie && bun link` -> exit `0`
- `cd /tmp/genie-release-branch.boKJb2/genie && command -v genie` -> exit `0` (`/Users/dallascrilley/.bun/bin/genie`)
- `cd /tmp/genie-release-branch.boKJb2/genie && genie --help` -> exit `0`
- `cd /tmp/genie-release-branch.boKJb2/genie && genie providers list --json` -> exit `0`
- `cd /tmp/genie-release-branch.boKJb2/genie && genie "reply with exactly: release smoke ok"` -> exit `0`, stdout `release smoke ok`
- `cd /tmp/genie-release-branch.boKJb2/genie && genie run --provider codex --no-fallback --plain "reply with exactly: release smoke ok"` -> exit `0`, stdout `release smoke ok`
- `cd /tmp/genie-release-branch.boKJb2/genie && genie run --provider codex --no-fallback --json "reply with exactly: release smoke ok"` -> exit `0`, response `release smoke ok`

### Provider diagnostics

- `cd /tmp/genie-release-branch.boKJb2/genie && genie providers doctor --json` -> exit `0`
- `cd /tmp/genie-release-branch.boKJb2/genie && genie providers doctor --provider claude --json` -> exit `0`
- `cd /tmp/genie-release-branch.boKJb2/genie && genie providers doctor --provider codex --json` -> exit `0`
- `cd /tmp/genie-release-branch.boKJb2/genie && genie providers doctor --provider cursor-agent --json` -> exit `0`
- `cd /tmp/genie-release-branch.boKJb2/genie && genie providers doctor --provider gemini --json` -> exit `0`

Provider summary:

- `claude`: available + authenticated
- `codex`: available + authenticated
- `gemini`: available + authenticated via `GEMINI_API_KEY`
- `cursor-agent`: available, not authenticated in this worktree because workspace trust is still required

### Exit-code matrix

- `cd /tmp/genie-release-branch.boKJb2/genie && genie run --provider codex --no-fallback --plain "reply with exactly: release smoke ok"` -> exit `0`
- `cd /tmp/genie-release-branch.boKJb2/genie && genie commit` -> exit `1`
- `cd /tmp/genie-release-branch.boKJb2/genie && genie run --unknown-flag bad` -> exit `2`
- `cd /tmp/genie-release-branch.boKJb2/genie && genie run --provider cursor-agent --no-fallback "auth check prompt"` -> exit `3`
- `cd /tmp/genie-release-branch.boKJb2/genie && genie run --provider gemini --no-fallback --timeout-ms 1 "timeout check"` -> exit `124`

Note: the `cursor-agent` exit code was the only product defect found during this sweep. The branch-tip
fix preserves auth-only failures as aggregated auth errors so the CLI again returns `3` instead of `1`.

## Optional Codex Cloud Follow-Through

Task reviewed: `task_e_69ab32b08fc483339f87a48bfeb32b1f`

- Decision: do not apply here as-is after release follow-up review
- Scope: workflow/docs + `genie/scripts/quantify-doctor-flake.ts`
- Caveat: the diff targets a different workflow surface than this repo's current CI and introduces a
  privileged manual-dispatch path, so keep the local `doctor:flake` script as the source of truth
  unless a repo-native post-release workflow is designed intentionally

## Release Decision

Go/No-Go: **Released**

- Verified:
  - clean release worktree
  - fresh-install prerequisite documented
  - build/typecheck/tests green
  - installed-binary smoke green
  - plain/json command contract green
  - provider doctor green with an explicit `cursor-agent` waiver
  - exit-code matrix green
- Release outcome:
  - `v0.1.0` was created on 2026-03-06 against `main` commit `181cb7843dbaa1a1b952dae5229e2cd3a1cc7c50`
- Remaining follow-up actions:
  - keep `cursor-agent` trust/auth behavior documented until a reproducible bootstrap path exists
  - extend CI beyond typecheck/test/build with linked-binary contract smoke checks
