# Review Command Implementation Plan

**Date:** 2026-03-05
**Status:** Ready for Implementation
**Depends On:** `docs/plans/2026-03-05-review-command-syntax-design.md`
**Feature:** `genie review` for single-agent and all-agent code review

## 1) Scope

Implement the first production use case for `genie`:

- `genie review --agent <codex|claude|gemini|cursor>`
- `genie review --all`
- Optional `--diff-file <path>`
- Default diff source: current working-tree `git diff`

Out of scope (v1):

- job ids / async status
- staged/stdin/PR diff sources
- JSON output mode
- provider-specific prompt tuning flags

## 2) Acceptance Criteria

1. `genie review --agent codex` succeeds when changes exist and codex provider is available.
2. `genie review --all` dispatches all four providers in parallel and returns four ordered blocks.
3. `genie review --all --agent codex` fails with explicit mutual-exclusivity error.
4. `genie review --agent codex --diff-file <path>` uses file diff instead of `git diff`.
5. Empty diff returns a clear `no changes to review` error.
6. Exit codes:
   - `0`: all requested providers succeeded
   - `1`: one or more provider failures
   - `2`: user input/validation error

## 3) Architecture and Ownership

### CLI Surface

- Add `review` command and options parsing.
- Enforce exactly one target selector: `--agent` xor `--all`.

### Diff Resolution

- Resolve source with strict precedence:
  1. `--diff-file`
  2. `git diff`
- Normalize into shared payload consumed by provider executors.

### Dispatch Engine

- Single mode: run one provider.
- All mode: run four providers concurrently.
- Preserve deterministic output order: `codex`, `claude`, `gemini`, `cursor`.

### Result Aggregation

- Keep partial results when a subset fails.
- Render provider blocks with status and latency.
- Return aggregate footer summary and exit code.

## 4) Implementation Tasks

### Task A: Command and Validation

- Add/extend review command parser.
- Add `--agent`, `--all`, `--diff-file`.
- Implement mutual-exclusivity and required-target validation.
- Standardize validation errors to exit code `2`.

### Task B: Diff Source Loader

- Add diff loader utility:
  - read from file when `--diff-file` is set
  - otherwise run `git diff`
- Add empty-diff guard with friendly error.
- Add minimal diff stats helper (files/additions/deletions) for header output.

### Task C: Review Request Normalization

- Build shared request object:
  - source metadata
  - normalized diff text
  - repo/cwd context
- Ensure same request shape is sent to each provider.

### Task D: Provider Fanout and Ordering

- Implement target resolution:
  - single provider list for `--agent`
  - full provider list for `--all`
- Execute providers:
  - sequential for single
  - concurrent for all
- Capture per-provider duration and failure reason.
- Emit final output in deterministic provider order regardless of completion order.

### Task E: Exit Code Mapping

- Compute final status:
  - validation/input error -> `2`
  - provider partial/all failure -> `1`
  - full success -> `0`
- Ensure process exits with mapped code.

## 5) Testing Plan

### Unit Tests

- target selector validation (`--all` xor `--agent`)
- agent name validation
- diff source precedence (`--diff-file` over `git diff`)
- empty diff handling
- exit code mapping logic

### Integration Tests (mocked providers)

- single agent success path
- all providers success path with deterministic output ordering
- partial failure in `--all` preserves successful results
- flag conflict (`--all` + `--agent`) returns code `2`

### Smoke Tests

- run against at least one real provider in local environment
- verify `--diff-file` path flow with provided sample patch

## 6) Verification Commands

Use project-specific equivalents if these scripts differ:

```bash
bun test
bun run typecheck
bun run lint
```

Focused checks:

```bash
genie review --agent codex
genie review --all
genie review --all --agent codex ; echo $?
genie review --agent gemini --diff-file original-agents.diff
```

## 7) Risks and Mitigations

- Risk: provider latency causes confusing ordering.
  - Mitigation: always render final output in fixed provider order.
- Risk: diff parsing/stats mismatch across git versions.
  - Mitigation: keep stats best-effort and non-blocking.
- Risk: one provider error obscures others.
  - Mitigation: preserve per-provider block and aggregate footer.

## 8) Definition of Done

- All acceptance criteria pass.
- Unit + integration tests pass locally.
- Smoke tests validate single + all modes.
- Output is deterministic and readable for side-by-side review.

## 9) Task Checklist

- [ ] Implement `review` CLI options and validation.
- [ ] Implement diff source loader and empty-diff guard.
- [ ] Normalize shared review request payload.
- [ ] Implement single/all dispatch and ordered aggregation.
- [ ] Map exit codes exactly as designed.
- [ ] Add/extend tests for command behavior.
- [ ] Run verification commands and record outcomes.
