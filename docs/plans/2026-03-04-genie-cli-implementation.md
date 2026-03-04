# Genie CLI Implementation Plan

**Date:** 2026-03-04
**Status:** Ready for Implementation
**Scope:** Build `genie` v1 as a Bun-first TypeScript CLI using `dc-cli-kit` + incur semantics.

## 1) Requirements Restatement
- Provide a minimal UX: `genie <prompt...>` for headless LLM CLI usage.
- Support providers: `claude`, `codex`, `cursor-agent`, `gemini`.
- Hide provider flag/arg nuance behind adapters.
- Persist last-used defaults globally at `~/.config/genie/config.json`.
- Auto-fallback provider when preferred provider is unavailable or unauthenticated.
- Reuse provider-native authentication (no central auth broker).
- Default output behavior: pretty on TTY, JSON envelope when piped/non-TTY.
- Include optional aliases: `genie wish <prompt...>` and `genie rub <prompt...>`.

## 2) Acceptance Criteria (Testable)
1. Running `genie "hello"` executes one provider adapter and returns response output.
2. If default provider preflight fails, `genie` falls back to next configured provider automatically.
3. On successful execution, last-used provider/model/mode/workspace/output/trust are saved.
4. On non-TTY stdout (`| cat`), output is JSON-structured and parseable.
5. `genie wish "..."` and `genie rub "..."` resolve to the same execution pipeline.
6. Missing all providers returns a single actionable error listing per-provider failure reason.
7. Unit tests cover config persistence, fallback selection, and output mode resolution.
8. Integration tests cover success path + fallback path with mocked subprocess behavior.

## 3) File and Module Plan
Planned new project path: `genie/`

- `genie/package.json`
- `genie/tsconfig.json`
- `genie/vitest.config.ts`
- `genie/src/index.ts`
- `genie/src/cli.ts`
- `genie/src/types.ts`
- `genie/src/config/schema.ts`
- `genie/src/config/store.ts`
- `genie/src/runtime/tty.ts`
- `genie/src/runtime/workspace.ts`
- `genie/src/providers/base.ts`
- `genie/src/providers/claude.ts`
- `genie/src/providers/codex.ts`
- `genie/src/providers/cursor-agent.ts`
- `genie/src/providers/gemini.ts`
- `genie/src/providers/registry.ts`
- `genie/src/execution/preflight.ts`
- `genie/src/execution/fallback.ts`
- `genie/src/execution/run-request.ts`
- `genie/src/execution/normalize.ts`
- `genie/src/errors.ts`
- `genie/test/config.store.test.ts`
- `genie/test/execution.fallback.test.ts`
- `genie/test/runtime.tty.test.ts`
- `genie/test/run-request.integration.test.ts`

## 4) Implementation Steps

### Phase A: Bootstrap CLI Skeleton
- Initialize `genie/` with Bun-first TypeScript setup.
- Add dependencies: `dc-cli-kit`, `zod` (peer alignment as needed), `vitest`.
- Implement root CLI with commands:
  - `_root` handler via `genie <prompt...>`
  - `wish` and `rub` as aliases/forwarders

Verification:
- `bun run build`
- `bun run test --runInBand` (or project equivalent)

### Phase B: Config and State Persistence
- Define config schema (provider defaults, model map, mode, trust, output, workspace).
- Implement XDG-path store read/write with atomic save behavior.
- Ensure last-used update occurs only on successful execution.

Verification:
- Unit tests for read defaults, write/update, corrupt-file handling.

### Phase C: Provider Adapter Layer
- Implement base provider adapter interface.
- Build adapters for `claude`, `codex`, `cursor-agent`, `gemini` with:
  - binary presence check
  - auth status check (native CLI)
  - command arg assembly
  - stdout/stderr/code capture
  - parser to normalized response

Verification:
- Unit tests for arg generation and parse normalization per provider.

### Phase D: Fallback Execution Engine
- Implement provider selection order:
  1. explicit override (if passed)
  2. last-used provider
  3. configured fallback order
- On preflight/exec failure, move to next provider.
- Aggregate failure reasons and return one structured error if exhausted.

Verification:
- Integration tests with mocked subprocess:
  - preferred fails -> fallback succeeds
  - all fail -> aggregated error

### Phase E: Output Policy and Runtime Resolution
- Detect TTY and select output mode:
  - TTY -> pretty
  - non-TTY -> JSON envelope
- Respect explicit override flags (`--json`, `--format`).
- Resolve workspace by precedence:
  1. explicit option
  2. last-used workspace
  3. current working directory

Verification:
- Tests for TTY and piped behavior.
- Tests for workspace precedence.

### Phase F: Hardening and Docs
- Add actionable error hints for missing auth/binary.
- Add README usage examples and migration examples from raw provider commands.
- Add `--help` examples including `wish`/`rub`.

Verification:
- `bun run test`
- Manual smoke checks with each installed provider binary.

## 5) Risks and Mitigations
- Risk: Provider CLIs change flags or output shape.
  - Mitigation: isolate per-provider parser and arg builder; add fixture tests.
- Risk: Auth state detection differs across providers.
  - Mitigation: preflight checks return typed reason codes and fallback immediately.
- Risk: Non-TTY behavior inconsistent across shells.
  - Mitigation: explicit mode override flags + shell-based smoke tests.

## 6) Definition of Done
- All acceptance criteria pass.
- Tests pass locally for unit + integration suites.
- `genie` basic commands work for at least one provider plus one fallback scenario.
- Design and implementation docs are in `docs/plans/`.

## 7) Execution Checklist
- [ ] Create `genie/` scaffold and tooling config.
- [ ] Implement config schema and persistence.
- [ ] Implement provider adapter interface and four providers.
- [ ] Implement fallback engine and preflight checks.
- [ ] Implement output mode + workspace resolution.
- [ ] Write and pass tests.
- [ ] Run end-to-end smoke checks.
- [ ] Finalize docs.
