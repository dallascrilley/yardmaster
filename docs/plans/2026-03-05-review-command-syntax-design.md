# Review Command Syntax Design

**Date:** 2026-03-05
**Status:** Approved
**Author:** Dallas Crilley + Codex

## Overview

This design defines the first CLI use case: requesting code review from one or all four coding agents with the same syntax. The command prioritizes speed for the first successful run while preserving deterministic output and clear error behavior.

## Goals

- Enable one-command review for all providers.
- Support one-provider review with the same command surface.
- Keep default behavior minimal and fast.
- Keep output consistent for easy side-by-side comparison.

## Command Surface

Primary command:

```bash
genie review
```

Target selectors (mutually exclusive):

- `--agent <codex|claude|gemini|cursor>`
- `--all`

Diff input:

- `--diff-file <path>` optional
- Default when omitted: current working tree `git diff`

Examples:

```bash
genie review --agent codex
genie review --all
genie review --agent gemini --diff-file original-agents.diff
genie review --all --diff-file original-agents.diff
```

Validation rules:

- Exactly one target selector is required: `--agent` xor `--all`.
- If both are present, return explicit conflict error.
- If neither is present, return actionable usage error.
- If diff is empty, return `no changes to review`.

## Execution Flow

1. Parse flags and validate mutual exclusivity.
2. Resolve diff source from `--diff-file` or default `git diff`.
3. Normalize one shared review payload.
4. Dispatch:
   - Single mode: one provider request.
   - All mode: four provider requests in parallel.
5. Aggregate results and render in deterministic provider order:
   - `codex`, `claude`, `gemini`, `cursor`

## Output Contract

Header:

- Mode (`single` or `all`)
- Targets
- Diff source (`git diff` or file path)
- Diff stats (files, additions, deletions)

Provider block (per target):

- Provider id
- Status (`ok` or `error`)
- Latency
- Review content (or concise error reason)

Footer:

- Summary (`success: N/M`, `failed: X`)

## Exit Codes

- `0`: all requested providers succeeded
- `1`: one or more requested providers failed
- `2`: CLI validation/input errors

## Explicit v1 Boundaries (YAGNI)

Not in scope for v1:

- Async jobs/status polling
- Persistence/job ids
- Retries exposed as user flags
- Provider-specific prompt flags
- Additional diff sources (`--stdin`, staged, PR refs)
- JSON output mode

## Future Extensions (Non-Breaking)

Potential v1.1+ additions that do not break this surface:

- `--format json`
- `--staged`
- `--timeout`
- `genie review status <id>` (if job model is introduced later)

## Success Criteria

Primary success criterion from design session:

- Fastest path to first review with minimal typing and clear behavior.

## Next Steps

- Implement `genie review` with strict target validation and default diff behavior.
- Add integration tests for:
  - `--agent` success path
  - `--all` parallel fanout
  - `--all` + `--agent` conflict
  - empty diff failure
