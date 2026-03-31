# AGENTS.md

Repository scope: this file applies to the entire `genie-cli` repository.

## Quick Reference

- Task tracking: use `td` as the source of truth; run `td usage --new-session` at the start of each session, keep TD updated during execution, and leave next actions reflected there before finishing.
- Architecture truth: prompt commands and `genie review` are ACP-first flows; `genie providers doctor` remains CLI/doctor-oriented. Do not document legacy spawn-adapter architecture as the current design.
- Verification parity with CI (from `genie/`): `bun install --frozen-lockfile`, `bun run typecheck`, `bun run test`, `bun run build`, `bun run test:critical-path`.
- Optional smoke: `bun run test:smoke` or the quicker `bun run test:smoke:preflight`; CI workflows in-repo are `.github/workflows/ci.yml` and `.github/workflows/smoke.yml`. Blank-name `startup_failure` runs are historical/admin noise, not a repo workflow file.
- Docs-only merge policy: docs/config-guidance-only changes may be auto-merged after fresh review when CI is green or not applicable and there are no unresolved findings. Do not treat this as permission for runtime, test, build-script, or dependency changes.

## Detailed Guidance

- [Architecture](docs/ARCHITECTURE.md) — system design, ACP-era module map, request lifecycle.
- [Contributing](docs/CONTRIBUTING.md) — setup, development workflow, project structure, provider guidance.
- [Release checklist](docs/release-checklist.md) — release verification and workflow expectations.
- [Dispatch skill](.claude/skills/genie-dispatch/SKILL.md) — provider strengths and routing guidance.
- [Specifications](specs/) — feature requirements and design decisions.
