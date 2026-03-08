# PR Summary: Stabilization Modularization Wave

## Title

refactor(genie): modularize cli orchestration and helpers

## Summary

This change lands the approved post-`v0.1.0` stabilization wave for `genie`. It preserves CLI behavior while breaking large coordinator files into smaller modules across CLI routing, parsing, providers, review flow, execution helpers, help text, and error formatting.

## Why

The project had already reached a point where adding features was slowed by oversized orchestration files. This refactor keeps behavior, tests, JSON contracts, help text, exit codes, and provider-doctor behavior stable while making the codebase easier to extend safely.

## Key Changes

- Split CLI dispatch into prompt vs state flows and then by state-command domain.
- Split CLI parser helpers into prompt vs state flows and then by state-command domain.
- Split review flow into selection, diff-source, execution, report, schema, git context, and git diff helpers.
- Split provider helpers into command running, default checks, codex auth helpers, mapped args by provider, and doctor helpers/types.
- Split execution helpers into request schema, provider order, persistence, envelopes, and fallback bookkeeping.
- Split help text and error-formatting helpers into dedicated modules.
- Added review and landing bundle docs so the stack is easy to review and ship.

## Validation

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

Latest observed results:

- `npm test`: 34 files, 147 tests passed
- `npm run typecheck`: passed
- `npm run build`: passed
- help and review schema commands: passed
- `providers doctor --provider codex --json`: passed
- `providers doctor --provider cursor-agent --json`: returned expected actionable trust/sign-in hint

## Notes

- Commit landed locally as `5e5f0f5`.
- The unrelated local file `docs/plans/2026-03-08-post-release-stabilization-execplan.md` was intentionally left unstaged and is not part of this change.
