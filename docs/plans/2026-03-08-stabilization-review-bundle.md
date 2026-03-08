# Stabilization Review Bundle

## Purpose

This document consolidates the post-`v0.1.0` stabilization stack so a reviewer can process the refactor series quickly. The changes are intentionally behavior-preserving: they split large coordinator files into smaller modules while keeping the CLI contract, tests, help output, JSON envelopes, exit codes, and provider doctor behavior stable.

## Verification Baseline

All slices in this stack share the same latest verified baseline:

```bash
cd genie
npm test
npm run typecheck
npm run build
node dist/bin/genie.js --help
node dist/bin/genie.js review --json-schema
node dist/bin/genie.js providers doctor --provider codex --json
node dist/bin/genie.js providers doctor --provider cursor-agent --json
```

Observed result at the latest checkpoint:

- `npm test`: 34 test files passed, 147 tests passed
- `npm run typecheck`: passed
- `npm run build`: passed
- `providers doctor --provider cursor-agent --json`: still unauthenticated in this workspace, but now returns an actionable trust/sign-in hint

## Review Queue

Recommended review order:

1. `td-f9df4f` — umbrella stabilization task
2. `td-402459` — split CLI dispatch by command family
3. `td-20a602` — split CLI parser helpers by command family
4. `td-26c2ec` — split review command helpers by responsibility
5. `td-26ca13` — split provider base helpers by responsibility
6. `td-920f60` — split run-request helpers by responsibility
7. `td-e71d55` — split fallback execution helpers by responsibility
8. `td-a5277f` — split request normalization helpers by responsibility
9. `td-db3ca0` — split codex provider auth helpers by responsibility
10. `td-950d94` — split provider mapped-arg helpers by provider
11. `td-47b79c` — split review execution helpers by responsibility
12. `td-05e864` — split CLI error formatting helpers by responsibility
13. `td-1dbe77` — split state command dispatch helpers by domain
14. `td-90b0c3` — split parser state-command helpers by domain
15. `td-86aa1b` — split CLI help text by topic
16. `td-a0f5e1` — split git service helpers by responsibility
17. `td-658153` — split provider doctor helpers by responsibility
18. `td-ebf1df` — split review formatting helpers by responsibility
19. `td-9a6aa1` — table-drive root CLI parse/dispatch routing

Duplicate cleanup: `td-ee1467` was closed as a duplicate of `td-05e864`, so reviewers should ignore it and focus on the review queue above.

## What Changed

The refactor stack mainly moved logic out of these original hotspots:

- `genie/src/cli.ts`
- `genie/src/cli/parse.ts`
- `genie/src/review/command.ts`
- `genie/src/review/git-service.ts`
- `genie/src/providers/base.ts`
- `genie/src/providers/codex.ts`
- `genie/src/providers/doctor.ts`
- `genie/src/execution/run-request.ts`
- `genie/src/execution/fallback.ts`
- `genie/src/execution/normalize.ts`
- `genie/src/errors.ts`
- `genie/src/cli/help.ts`

The largest structural outcomes are:

- root parse/dispatch moved to table-driven routing
- state command dispatch and state parser logic are split by domain
- provider execution/auth/doctor helpers are split by concern
- review flow is split into selection, diff-source, execution, report, schema, and git helpers
- execution flow is split into normalization, provider order, fallback bookkeeping, persistence, and envelope helpers
- help text is split into root vs topic modules
- error formatting is split from error-class/exit-code logic

## Files Reviewers Should Spot-Check

- `genie/src/cli.ts`
- `genie/src/cli/dispatch.ts`
- `genie/src/cli/parse.ts`
- `genie/src/review/command.ts`
- `genie/src/review/execute.ts`
- `genie/src/providers/base.ts`
- `genie/src/providers/doctor.ts`
- `genie/src/execution/run-request.ts`
- `genie/src/errors.ts`
- `README.md`
- `docs/release-checklist.md`

## Expected Reviewer Outcome

If the reviewer sees unchanged behavior with materially clearer file boundaries and the validation baseline above still holds, the stack is ready to approve incrementally or as a grouped cleanup wave.

## Approval Checklist

Use this as a fast pass for each review item:

- Confirm the slice only rearranges code and preserves external behavior.
- Spot-check the files listed in the task handoff against the shared verification baseline.
- Confirm no JSON envelope, help text, exit code, or provider-doctor regression appears in the touched surface.
- Prefer approving the queue in the documented order because later slices build on earlier decompositions.

Suggested grouped review passes:

1. CLI shell and routing
   - `td-f9df4f`
   - `td-402459`
   - `td-20a602`
   - `td-1dbe77`
   - `td-90b0c3`
   - `td-9a6aa1`
2. Review flow
   - `td-26c2ec`
   - `td-47b79c`
   - `td-a0f5e1`
   - `td-ebf1df`
3. Provider layer
   - `td-26ca13`
   - `td-db3ca0`
   - `td-950d94`
   - `td-658153`
4. Execution layer
   - `td-920f60`
   - `td-e71d55`
   - `td-a5277f`
5. Docs and error/help polish
   - `td-05e864`
   - `td-86aa1b`
   - `td-ba084a`

## Reviewer Commands

Run reviews from a different TD session than the implementation session.

Fastest path:

```bash
# start with the umbrella task
 td context td-f9df4f
 td approve td-f9df4f
```

Then work through grouped batches:

```bash
# CLI shell and routing
 td context td-402459 && td approve td-402459
 td context td-20a602 && td approve td-20a602
 td context td-1dbe77 && td approve td-1dbe77
 td context td-90b0c3 && td approve td-90b0c3
 td context td-9a6aa1 && td approve td-9a6aa1
```

```bash
# Review flow
 td context td-26c2ec && td approve td-26c2ec
 td context td-47b79c && td approve td-47b79c
 td context td-a0f5e1 && td approve td-a0f5e1
 td context td-ebf1df && td approve td-ebf1df
```

```bash
# Provider layer
 td context td-26ca13 && td approve td-26ca13
 td context td-db3ca0 && td approve td-db3ca0
 td context td-950d94 && td approve td-950d94
 td context td-658153 && td approve td-658153
```

```bash
# Execution layer
 td context td-920f60 && td approve td-920f60
 td context td-e71d55 && td approve td-e71d55
 td context td-a5277f && td approve td-a5277f
```

```bash
# Docs and help/error polish
 td context td-05e864 && td approve td-05e864
 td context td-86aa1b && td approve td-86aa1b
 td context td-ba084a && td approve td-ba084a
 td context td-69709d && td approve td-69709d
```


## Recommended Next Move

Stop creating additional micro-refactors for now and process the queued review stack. The remaining modules are small coordinator files, so additional atomization is unlikely to pay for the extra review overhead.
