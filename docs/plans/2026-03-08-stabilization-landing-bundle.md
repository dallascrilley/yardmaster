# Stabilization Landing Bundle

## Purpose

This document is the final handoff for landing the approved post-`v0.1.0` stabilization stack. The code changes are already reviewed and approved in TD; this bundle exists to help a maintainer turn the working tree into one or more sensible commits without re-discovering scope.

## Scope Summary

The stabilization stack is a behavior-preserving modularization wave across the `genie` CLI plus small supporting doc updates.

Primary code areas changed:

- `genie/src/cli.ts`
- `genie/src/cli/parse.ts`
- `genie/src/errors.ts`
- `genie/src/execution/*.ts`
- `genie/src/providers/*.ts`
- `genie/src/review/*.ts`

Supporting docs changed:

- `.gitignore`
- `README.md`
- `docs/release-checklist.md`
- `docs/todo.md`
- `docs/plans/2026-03-08-post-v0.1.0-next-sprint-execplan.md`
- `docs/plans/2026-03-08-stabilization-review-bundle.md`

## Shared Verification Baseline

Before landing, rerun the shared baseline from repo root:

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

Expected outcome:

- tests/typecheck/build succeed
- help and review schema commands succeed
- codex doctor succeeds in the current environment
- cursor-agent doctor may remain unauthenticated, but must return the actionable trust/sign-in hint

## Recommended Landing Strategy

Preferred option: land as one cleanup commit if the maintainer is comfortable with a single broad but reviewed refactor.

Suggested commit message:

```text
refactor(genie): modularize cli orchestration and provider/review helpers
```

Alternative option: split into two commits if smaller reviewable history is preferred.

1. Core CLI/runtime modularization
   - CLI parse/dispatch/help/error changes
   - execution/provider/review helper splits
2. Docs and review-support artifacts
   - `.gitignore`
   - `README.md`
   - `docs/release-checklist.md`
   - `docs/todo.md`
   - planning/review bundle docs

Suggested second commit message:

```text
docs(genie): add stabilization review and landing bundles
```

## Files to Stage Together

### Core refactor set

```bash
git add \
  genie/src/cli.ts \
  genie/src/cli/dispatch.ts \
  genie/src/cli/dispatch/ \
  genie/src/cli/help.ts \
  genie/src/cli/help/ \
  genie/src/cli/output.ts \
  genie/src/cli/parse.ts \
  genie/src/cli/parse/ \
  genie/src/errors.ts \
  genie/src/error-format.ts \
  genie/src/execution/ \
  genie/src/providers/base.ts \
  genie/src/providers/claude.ts \
  genie/src/providers/codex.ts \
  genie/src/providers/codex-auth.ts \
  genie/src/providers/cursor-agent.ts \
  genie/src/providers/doctor.ts \
  genie/src/providers/doctor-helpers.ts \
  genie/src/providers/doctor-types.ts \
  genie/src/providers/gemini.ts \
  genie/src/providers/mapped-args/ \
  genie/src/review/ \
  genie/test/providers.doctor.test.ts
```

Note: stage the deletion of `genie/src/providers/mapped-args.ts` along with the new `genie/src/providers/mapped-args/` directory.

### Docs/supporting set

```bash
git add \
  .gitignore \
  README.md \
  docs/release-checklist.md \
  docs/todo.md \
  docs/plans/2026-03-08-post-v0.1.0-next-sprint-execplan.md \
  docs/plans/2026-03-08-stabilization-review-bundle.md \
  docs/plans/2026-03-08-stabilization-landing-bundle.md
```

## Files to Leave Alone

Do not stage these local/unrelated artifacts without explicit confirmation:

- `docs/plans/2026-03-08-post-release-stabilization-execplan.md`
- any `.omc/` or `.omcodex/` local session content that remains outside ignore rules

## TD Review Status

The stabilization slices were reviewed and approved in a separate TD session. Use the review bundle for exact IDs and grouped context:

- `docs/plans/2026-03-08-stabilization-review-bundle.md`

The queue itself is now clean of stale in-progress items.

## Landing Checklist

- [ ] Re-run shared verification baseline
- [ ] Stage either the full stack or the two recommended groups
- [ ] Confirm `git diff --cached --stat` matches intended scope
- [ ] Commit with the chosen message(s)
- [ ] Optionally generate release notes/changelog from the approved stack if needed

## Expected Outcome

After landing, the repo should retain exactly the same CLI behavior and validation results, but with far smaller and clearer modules across CLI routing, parsing, providers, execution, review flow, help text, and error formatting.
