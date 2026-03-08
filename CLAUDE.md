# CLAUDE.md

Repository scope: this file applies to the entire `genie-cli` repository.

## Docs Merge Policy

- Agents may auto-merge docs-only updates after a fresh review when the diff is limited to documentation/config guidance files, CI is green or not applicable, and there are no unresolved review findings.
- Treat this allowance as docs-only: do not auto-merge if the branch includes runtime code, tests, build scripts, or dependency changes.
