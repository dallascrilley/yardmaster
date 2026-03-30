# AGENTS.md

Repository scope: this file applies to the entire `genie-cli` repository.

## Start Here for Agents

Welcome to the `genie-cli` repository. This project provides a unified AI CLI with deterministic provider routing and robust execution.

### Key Onboarding Path
1. **Architecture**: Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) to understand the system design, module map, and request lifecycle.
2. **Contributing**: See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for development setup, conventions, and extension guides.
3. **Capabilities**: Explore the [genie-dispatch skill](.claude/skills/genie-dispatch/SKILL.md) for provider strengths and decision trees.
4. **Specifications**: Review the [specs/](specs/) directory for detailed feature requirements and design decisions.

## MANDATORY: Use TD for Task Management

- Use `td` as the source of truth for task tracking in this repo.
- At the start of each new conversation/session, run `td usage --new-session`.
- During execution, keep task state updated in TD instead of ad-hoc notes.
- Before finishing work, ensure TD reflects current status and next actions.

## Verification (parity with CI)

From `genie/` (matches `.github/workflows/ci.yml`):

```bash
bun install --frozen-lockfile
bun run typecheck
bun run test
bun run build
bun run test:critical-path
```

Optional real-LLM smoke (secrets + provider CLIs): `bun run test:smoke` (slow); quicker subset: `bun run test:smoke:preflight` or `GENIE_SMOKE_PROVIDERS=gemini bun run test:smoke`. There is no separate `lint` script; **`typecheck` is the static analysis gate**.

## Docs Merge Policy

- Agents may auto-merge docs-only updates after a fresh review when the diff is limited to documentation/config guidance files, CI is green or not applicable, and there are no unresolved review findings.
- Treat this allowance as docs-only: do not auto-merge if the branch includes runtime code, tests, build scripts, or dependency changes.
