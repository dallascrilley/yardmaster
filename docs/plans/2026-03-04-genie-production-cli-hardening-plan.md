# Genie Production CLI Hardening Implementation Plan

> **For Codex:** Execute this plan task-by-task.

**Goal:** Ship a production-usable `genie` CLI with deterministic command parsing, provider routing, script-safe output, explicit exit codes, and non-hanging execution.
**Architecture:** Keep the current TypeScript CLI entrypoint and execution pipeline, but formalize the command tree (`run`, `providers`, `config`) around a compatibility shim for legacy `genie <prompt>`. Centralize output/error/exit-code policy so subcommands share one runtime contract. Isolate provider-specific preflight/invocation parsing in adapters with bounded timeouts and test fixtures.
**Scope:** In: CLI command surface, runtime output semantics, exit-code mapping, provider preflight/invocation hardening, fallback controls, config precedence and commands, diagnostics (`providers doctor`), tests, and README parity. Out: new providers, remote API changes, packaging/distribution changes, destructive config reset behavior.
**Assumptions:**
- Existing provider set remains `claude`, `codex`, `cursor-agent`, `gemini`.
- Toolchain remains Node/Bun + TypeScript + Vitest under `genie/`.
- `genie/src/bin/genie.ts` continues to be the executable entrypoint.
- Local provider binaries may differ by machine, so adapter checks must degrade with actionable diagnostics.

---

## Task Flow

### Task 1: Baseline and Command-Surface Contract Lock
**Files:**
- Modify: `genie/src/cli.ts`
- Modify: `genie/src/types.ts`
- Create: `genie/test/cli.parser.test.ts`
- Test: `genie/test/run-request.integration.test.ts`

**Steps:**
1. Define a normalized command model that supports `genie <prompt>` as a compatibility shim and `genie run <prompt>` as the explicit path.
2. Add command branches for `providers` and `config` with strict parse/validation behavior.
3. Update help text to reflect the full tree and global/run flag split.
4. Add parser tests for legacy shorthand, subcommands, unknown flags, and missing args.

**Acceptance Criteria:**
- [ ] `genie <prompt>` and `genie run <prompt>` both parse and execute consistently.
- [ ] `genie --help` displays `run`, `providers`, and `config` command tree.
- [ ] Parse/usage failures are distinguishable for exit-code mapping.

**Verification Commands:**
```bash
cd genie && bun run test test/cli.parser.test.ts
cd genie && bun run typecheck
```

**Expected Result:**
- Parser tests pass and command tree snapshots are stable.

---

### Task 2: Runtime Output Contract Normalization (`--json`, `--plain`, pretty)
**Files:**
- Modify: `genie/src/runtime/tty.ts`
- Modify: `genie/src/execution/run-request.ts`
- Modify: `genie/src/cli.ts`
- Create: `genie/test/output.contract.test.ts`

**Steps:**
1. Define a single output-mode resolver honoring `--json`, `--plain`, `--quiet`, `--verbose`, TTY, and `--no-color`.
2. Enforce stdout/stderr split: payload/machine output only on stdout; diagnostics/warnings/errors on stderr.
3. Implement deterministic JSON envelope field ordering: `provider`, `model`, `response`, `fallbackUsed`, `timings`, `error`.
4. Add output snapshot tests for JSON mode, plain mode, pretty mode, and quiet/verbose interactions.

**Acceptance Criteria:**
- [ ] No diagnostics leak to stdout in JSON mode.
- [ ] `--plain` emits response text only.
- [ ] JSON envelope is stable for snapshot-based consumers.

**Verification Commands:**
```bash
cd genie && bun run test test/output.contract.test.ts
cd genie && bun run test test/runtime.tty.test.ts test/execution.normalize.test.ts
```

**Expected Result:**
- Output contract snapshots pass without nondeterministic fields.

---

### Task 3: Explicit Exit-Code Mapping and Error Taxonomy
**Files:**
- Modify: `genie/src/errors.ts`
- Modify: `genie/src/cli.ts`
- Modify: `genie/src/execution/run-request.ts`
- Create: `genie/test/cli.exit-codes.integration.test.ts`

**Steps:**
1. Introduce/align error classes for usage, auth/configuration, runtime/provider failure, and timeout.
2. Map failures to exit codes: `0`, `1`, `2`, `3`, `124`.
3. Ensure parser/validation failures map to usage (`2`) instead of generic runtime failure.
4. Add spawned CLI integration tests that assert both stderr messaging and exit status.

**Acceptance Criteria:**
- [ ] Parse/validation errors return exit code `2`.
- [ ] Timeout failures return exit code `124`.
- [ ] Auth/configuration failures return exit code `3`.

**Verification Commands:**
```bash
cd genie && bun run test test/cli.exit-codes.integration.test.ts
cd genie && bun run test test/run-request.integration.test.ts
```

**Expected Result:**
- Integration tests confirm exit codes and output channels match contract.

---

### Task 4: Provider Contract Hardening (Preflight + Bounded Checks)
**Files:**
- Modify: `genie/src/providers/base.ts`
- Modify: `genie/src/providers/claude.ts`
- Modify: `genie/src/providers/codex.ts`
- Modify: `genie/src/providers/cursor-agent.ts`
- Modify: `genie/src/providers/gemini.ts`
- Create: `genie/test/providers.contract.test.ts`

**Steps:**
1. Replace generic auth assumptions with provider-specific preflight checks and capability mapping.
2. Add bounded timeout wrappers for provider preflight and execution checks to prevent hangs.
3. Normalize preflight result structure: availability, auth status, version detection, actionable hint.
4. Add mocked contract tests including codex unsupported-auth-status scenarios.

**Acceptance Criteria:**
- [ ] Codex preflight no longer false-fails on unsupported auth-status probes.
- [ ] Preflight/execution checks cannot hang indefinitely.
- [ ] Provider error hints are specific and actionable per adapter.

**Verification Commands:**
```bash
cd genie && bun run test test/providers.contract.test.ts
cd genie && bun run test test/providers.base.test.ts
```

**Expected Result:**
- Provider contract tests pass across all adapters with timeout coverage.

---

### Task 5: Provider Invocation Syntax and Parsing Robustness
**Files:**
- Modify: `genie/src/providers/claude.ts`
- Modify: `genie/src/providers/codex.ts`
- Modify: `genie/src/providers/cursor-agent.ts`
- Modify: `genie/src/providers/gemini.ts`
- Create: `genie/test/providers.adapters.test.ts`
- Create: `genie/test/fixtures/providers/*`

**Steps:**
1. Validate and update invocation argument shapes per provider adapter for current CLI behavior.
2. Harden stdout/stderr parsing to tolerate non-critical warnings and output shape drift.
3. Add fixture-driven adapter tests for success, usage error, auth error, timeout, and malformed output.
4. Keep adapter-specific parsing logic isolated to avoid cross-provider regressions.

**Acceptance Criteria:**
- [ ] Each provider adapter has tested invocation and parse paths.
- [ ] Non-response stderr lines do not corrupt response extraction.
- [ ] Adapter failures classify into the shared error taxonomy.

**Verification Commands:**
```bash
cd genie && bun run test test/providers.adapters.test.ts
cd genie && bun run typecheck
```

**Expected Result:**
- Adapter fixtures cover known stdout/stderr variability and pass consistently.

---

### Task 6: Fallback Telemetry and `--no-fallback`
**Files:**
- Modify: `genie/src/execution/fallback.ts`
- Modify: `genie/src/execution/run-request.ts`
- Modify: `genie/src/cli.ts`
- Modify: `genie/src/types.ts`
- Create: `genie/test/fallback.telemetry.test.ts`

**Steps:**
1. Add `--no-fallback` flag to run path and request model.
2. Preserve ordered provider attempts while enabling single-provider forced execution.
3. Include per-attempt telemetry (provider, stage, duration, reason) in aggregated failure details.
4. Add integration tests asserting ordered attempts, telemetry population, and no-fallback short-circuiting.

**Acceptance Criteria:**
- [ ] `--no-fallback` executes only requested/default provider once.
- [ ] Aggregated fallback errors include attempt stage and duration.
- [ ] Successful fallback sets `fallbackUsed` deterministically.

**Verification Commands:**
```bash
cd genie && bun run test test/fallback.telemetry.test.ts
cd genie && bun run test test/execution.fallback.test.ts
```

**Expected Result:**
- Fallback behavior is deterministic, observable, and regression-tested.

---

### Task 7: Configuration Precedence + `config` Command Family
**Files:**
- Modify: `genie/src/config/schema.ts`
- Modify: `genie/src/config/store.ts`
- Create: `genie/src/config/commands.ts`
- Modify: `genie/src/cli.ts`
- Create: `genie/test/config.precedence.test.ts`
- Create: `genie/test/config.commands.integration.test.ts`

**Steps:**
1. Implement deterministic resolution order: flags > env > project config > user config > defaults.
2. Add env variable mapping for `GENIE_PROVIDER`, `GENIE_MODEL`, `GENIE_MODE`, `GENIE_WORKSPACE`, `GENIE_TRUST`, `GENIE_TIMEOUT_MS`, `GENIE_OUTPUT`.
3. Implement `config get`, `config set`, `config init`, and `config path` with schema-key validation.
4. Ensure invalid keys/values return usage exit code (`2`) with actionable messages.

**Acceptance Criteria:**
- [ ] Precedence matrix is deterministic and covered by tests.
- [ ] `config set provider.default codex` persists and is readable via `config get`.
- [ ] `config init` creates user config without mutating project config unless requested.

**Verification Commands:**
```bash
cd genie && bun run test test/config.precedence.test.ts test/config.commands.integration.test.ts
cd genie && bun run test test/config.store.test.ts
```

**Expected Result:**
- Config commands work end-to-end and precedence tests pass.

---

### Task 8: Provider Diagnostics (`providers list` and `providers doctor`) + Docs Parity
**Files:**
- Create: `genie/src/providers/doctor.ts`
- Modify: `genie/src/providers/registry.ts`
- Modify: `genie/src/cli.ts`
- Create: `genie/test/providers.doctor.test.ts`
- Modify: `README.md`

**Steps:**
1. Implement `providers list [--json]` output for both human and machine modes.
2. Implement `providers doctor [--provider <id>] [--json]` with availability/auth/version/latency checks and bounded timeouts.
3. Add golden snapshots for `--help`, `providers list --json`, and `providers doctor --json`.
4. Update README usage, flags, output contract, exit codes, and troubleshooting to match real help output.

**Acceptance Criteria:**
- [ ] `providers list --json` emits valid machine-readable output.
- [ ] `providers doctor` gives concise human diagnostics and JSON equivalent.
- [ ] README examples match executable behavior and help text.

**Verification Commands:**
```bash
cd genie && bun run test test/providers.doctor.test.ts
cd genie && bun run test
```

**Expected Result:**
- Diagnostics commands and docs snapshots are in sync and passing.

---

## Risks and Rollback
- Provider CLI syntax drift can break adapters unexpectedly.
- Auth checks can vary by local environment and installed provider version.
- Timeout defaults may be too strict on slower machines.
- Regression risk for legacy `genie <prompt>` shorthand.

Rollback steps:
1. Revert adapter-specific preflight or invocation changes per provider file to isolate breakage.
2. Feature-gate new subcommands behind parser branch while retaining legacy path.
3. Temporarily disable strict diagnostics fields in JSON envelopes if snapshot breakage blocks release.
4. Restore previous fallback behavior if `--no-fallback` introduces routing regressions.

## Final Verification
```bash
cd genie && bun run typecheck
cd genie && bun run test
cd genie && bun run build
cd genie && bun run test test/cli.parser.test.ts test/cli.exit-codes.integration.test.ts test/output.contract.test.ts test/providers.doctor.test.ts
```
