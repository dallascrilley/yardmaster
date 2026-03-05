# Providers Doctor Flake Quantification (2026-03-05)

## Scope
- Command: `genie providers doctor`
- Modes: human output and `--json`
- Environment: isolated temp `HOME` + `XDG_CONFIG_HOME` per run
- Objective: measure timeout flake and exit-code instability across repeated runs

## Method
- Added reusable script: `genie/scripts/quantify-doctor-flake.ts`
- Added package command: `bun run doctor:flake`
- Ran two measurements:
  - Provider-specific: `codex`
  - Full provider set

## Results

### Codex-only (`--provider codex`)
- Human mode: 30 runs, exit codes `{0: 30}`, timeout detections `0`
  - latency: min `69ms`, p50 `72ms`, max `380ms`
- JSON mode: 30 runs, exit codes `{0: 30}`, timeout detections `0`
  - latency: min `70ms`, p50 `73ms`, max `81ms`

### All providers
- Human mode: 20 runs, exit codes `{0: 20}`, timeout detections `0`
  - latency: min `1332ms`, p50 `1360ms`, max `2256ms`
- JSON mode: 20 runs, exit codes `{0: 20}`, timeout detections `0`
  - latency: min `1340ms`, p50 `1400ms`, max `1640ms`

## Conclusion
- No timeout flake was reproduced in this run set.
- No human-vs-json instability was observed.
- Current timeout-retry behavior appears stable under repeated execution.

## Ongoing Guardrail
- Re-run before releases or after provider-adapter changes:
  - `cd genie && bun run doctor:flake -- --runs 20 --fail-on-flake`
