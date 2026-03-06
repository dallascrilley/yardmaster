<!--
Sync Impact Report
Version change: template -> 1.0.0
Modified principles:
- Principle slot 1 -> I. CLI Contract First
- Principle slot 2 -> II. Provider Abstraction Over Provider Leakage
- Principle slot 3 -> III. Tests Gate Every Behavior Change
- Principle slot 4 -> IV. Deterministic Execution and Failure Semantics
- Principle slot 5 -> V. Simplicity Before Orchestration
Added sections:
- Technical Standards
- Development Workflow
Removed sections:
- None
Templates requiring updates:
- ✅ /Users/dallascrilley/Code/cli-projects/genie-cli/.specify/templates/plan-template.md
- ✅ /Users/dallascrilley/Code/cli-projects/genie-cli/.specify/templates/spec-template.md
- ✅ /Users/dallascrilley/Code/cli-projects/genie-cli/.specify/templates/tasks-template.md
- ✅ /Users/dallascrilley/Code/cli-projects/genie-cli/docs/release-checklist.md
- ✅ /Users/dallascrilley/Code/cli-projects/genie-cli/.specify/templates/commands/
  (directory not present; no command template updates required)
Follow-up TODOs:
- None
Runtime guidance reviewed:
- /Users/dallascrilley/Code/cli-projects/genie-cli/README.md (aligned; no change required)
- /Users/dallascrilley/Code/cli-projects/genie-cli/docs/release-checklist.md (updated)
-->
# Genie CLI Constitution

## Core Principles

### I. CLI Contract First
- Every user-facing command MUST keep `stdout` reserved for payloads and machine
  output, and MUST keep `stderr` reserved for diagnostics, warnings, and errors.
- Any command intended for automation MUST expose a stable machine-readable mode
  or explicitly document why it does not.
- Changes to help text, JSON envelopes, non-TTY behavior, or exit codes MUST be
  documented and regression-tested in the same change.

Rationale: `genie` is consumed by humans, scripts, and other agents. Silent
command-contract drift breaks downstream automation immediately.

### II. Provider Abstraction Over Provider Leakage
- Provider-specific authentication checks, invocation syntax, and subprocess
  behavior MUST stay inside adapter, doctor, or preset-mapping layers.
- Root commands, config keys, and documented workflows MUST express
  provider-neutral intent first. Provider-specific flags require a documented
  cross-provider gap and accompanying tests.
- Fallback order, missing-binary handling, and authentication failures MUST
  produce deterministic, actionable reasons per provider.

Rationale: the project only delivers value as a unified CLI if provider quirks
do not leak into the primary interface.

### III. Tests Gate Every Behavior Change
- Any change to parsing, output envelopes, exit codes, fallback behavior,
  presets, config precedence, review output, or provider contracts MUST add or
  update automated tests under `genie/test/`.
- Tests for new behavior MUST fail before implementation or be introduced in the
  same change before merge. Untested behavior changes are non-compliant.
- Runtime-affecting changes MUST pass `cd genie && bun run typecheck && bun run
  test && bun run build` before completion unless an explicit blocker is
  recorded.

Rationale: CLI regressions are cheapest to catch at the contract boundary and
most expensive to debug after release.

### IV. Deterministic Execution and Failure Semantics
- Provider subprocess execution MUST have explicit timeout or cancellation
  behavior and MUST not hang indefinitely.
- JSON envelopes, schema output, and ordered review results MUST remain backward
  compatible unless a major constitutional or product-version change is approved.
- Timeout, fallback, aggregated failure, and provider-order behavior MUST be
  deterministic and testable.

Rationale: headless and agent-driven use depends on predictable completion and
stable machine-readable semantics.

### V. Simplicity Before Orchestration
- New abstractions, command trees, or workflow layers MUST be justified by
  repeated duplication, measurable complexity reduction, or documented user need.
- Prefer small modules, pure parse/validate helpers, and repo-native
  Bun/TypeScript conventions over speculative extensibility.
- Features that add long-lived orchestration, plugins, or session state are out
  of scope unless a spec explicitly cites an approved amendment.

Rationale: `genie` wins by being fast, legible, and dependable rather than
absorbing every possible workflow.

## Technical Standards

- Repository work MUST treat `genie/` as the runtime package, with source in
  `genie/src/`, tests in `genie/test/`, and build artifacts in `genie/dist/`.
- Feature plans and specs MUST account for the documented config precedence,
  supported providers, JSON output contracts, and exit-code behavior when those
  surfaces are affected.
- Documentation changes MUST ship in the same branch as command-contract or
  verification changes when `README.md`, `.specify` templates, or
  `docs/release-checklist.md` become inaccurate.
- Secrets, tokens, and provider-auth artifacts MUST NOT be written to committed
  docs, logs, examples, or test fixtures.

## Development Workflow

- Every implementation plan MUST pass a Constitution Check covering command
  contract impact, provider-boundary impact, required tests, and simplicity
  justification.
- Every feature spec for runtime behavior MUST state whether it changes stdout,
  stderr, JSON, exit codes, provider fallback, authentication, or timeout
  behavior. "No change" is an acceptable explicit answer.
- Tasks MUST include verification and documentation work when behavior,
  contract, or operator-facing workflows change.
- Code review MUST reject changes that violate Principles I-V unless the change
  includes a documented amendment or explicit exception approved in review.

## Governance
- This constitution supersedes conflicting guidance in ad hoc notes, draft plans,
  or stale templates within this repository.
- Amendments MUST update this file, the sync impact report at its top, and every
  affected template or runtime guidance document in the same change.
- Versioning policy for this constitution follows semantic versioning:
  MAJOR for incompatible principle removals or redefinitions, MINOR for new
  principles or materially expanded mandates, PATCH for clarifications that do
  not change required behavior.
- Compliance review is mandatory for plans, task lists, code review, and release
  sign-off. Violations MUST be fixed or explicitly justified in review before
  merge.

**Version**: 1.0.0 | **Ratified**: 2026-03-06 | **Last Amended**: 2026-03-06
