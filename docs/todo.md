# Todo

- [x] Phase 1: Gather purpose, constraints, success criteria
- [x] Phase 2: Explore architecture options and select v1 approach
- [x] Phase 3: Finalize detailed design decisions
- [x] Phase 4: Write design document to docs/plans
- [ ] Phase 5: Worktree setup (optional, implementation)
- [x] Phase 6: Planning handoff (implementation plan created)
- [x] Phase 7: Add integration coverage for run-request and runtime mode behavior
  - [x] Add mocked-subprocess success/fallback/failure integration tests
  - [x] Add output/workspace mode resolution tests
  - [x] Re-run verification commands

## Review
- Confirm design uses `dc-cli-kit` with incur semantics.
- Confirm v1 keeps YAGNI scope and defers sessions/history.
- Confirm implementation plan contains testable acceptance criteria and verification steps.
- Confirm CLI `help` command routes to usage output (`help`, `help <topic>`, `--json help`) without invoking providers.
- Confirm `config set mode.default` rejects unsupported values with clear guidance.
- Confirm provider availability checks retry once on timeout to reduce `providers doctor` false-missing results.
- Confirm `genie review` supports `--agent` and `--all` with mutual exclusivity, default `git diff`, and `--diff-file` override.
- Confirm parser regression coverage is table-driven for command-kind and validation-error stability across refactors.
