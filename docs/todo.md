# Todo

- [x] Phase 1: Gather purpose, constraints, success criteria
- [x] Phase 2: Explore architecture options and select v1 approach
- [x] Phase 3: Finalize detailed design decisions
- [x] Phase 4: Write design document to docs/plans
- [x] Phase 5: Worktree setup (optional, implementation)
- [x] Phase 6: Planning handoff (implementation plan created)
- [x] Phase 7: Add integration coverage for run-request and runtime mode behavior
  - [x] Add mocked-subprocess success/fallback/failure integration tests
  - [x] Add output/workspace mode resolution tests
  - [x] Re-run verification commands

## Review
- [x] Confirm design uses `dc-cli-kit` with incur semantics.
- [x] Confirm v1 keeps YAGNI scope and defers sessions/history.
- [x] Confirm implementation plan contains testable acceptance criteria and verification steps.
- [x] Confirm `genie commit` reads staged diff only, cleans provider markdown wrappers, and applies `git commit -m` only when `--apply` is set.
- [x] Confirm `genie debug` rejects empty stdin quickly and writes diagnosis text to stdout on success.
- [x] Confirm CLI `help` command routes to usage output (`help`, `help <topic>`, `--json help`) without invoking providers.
- [x] Confirm `config set mode.default` rejects unsupported values with clear guidance.
- [x] Confirm provider availability checks retry once on timeout to reduce `providers doctor` false-missing results.
- [x] Confirm `genie review` supports `--agent` and `--all` with mutual exclusivity, default `git diff`, and `--diff-file` override.
- [x] Confirm parser regression coverage is table-driven for command-kind and validation-error stability across refactors.

## Review Notes

- 2026-03-06: Verified merged `genie` CLI behavior on `main` with passing typecheck, tests,
  build, root help, provider inventory JSON, review JSON schema, and provider doctor smoke.
- 2026-03-06: Fresh-worktree release verification now requires `bun install --frozen-lockfile`
  before typecheck/test/build; the release checklist was updated to encode that step explicitly.
- 2026-03-06: Auth-only provider failures now preserve exit code `3` end-to-end; clean-worktree
  release smoke verified `0/1/2/3/124` and moved `cursor-agent` to an optional-but-documented
  release gate because workspace trust remains environment-local.

- 2026-03-08: Added stabilization review bundle and stacked refactor review order in `docs/plans/2026-03-08-stabilization-review-bundle.md`.

- 2026-03-08: Closed duplicate TD task `td-ee1467` and updated the stabilization review bundle to recommend review consolidation over further micro-refactors.
