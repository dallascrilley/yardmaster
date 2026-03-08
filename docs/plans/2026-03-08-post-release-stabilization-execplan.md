# Stabilize and Modularize the Post-v0.1.0 CLI

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries, Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.

## Purpose / Big Picture

After `v0.1.0`, the project is functional and green, but the next 1-2 sprints need to convert that good release state into a maintainable default. Someone working from this plan should be able to (1) clear the two pending review items in TD, (2) remove known release friction around `cursor-agent`, (3) stop local agent artifacts from dirtying the repository, and (4) refactor the oversized CLI entrypoint and parser into smaller modules without changing user-visible behavior. The visible outcome is that `genie` remains releaseable with less manual waiver logic, future command work lands in smaller files, and `git status` stays clean between sessions.

## Progress

- [x] (2026-03-08 07:35Z) Gathered current evidence from TD, git, CI, README, release docs, and core CLI/provider files.
- [ ] Approve `td-682e24` and split any remaining work into follow-up TD tasks instead of leaving release-readiness open.
- [ ] Approve `td-32ae0d` after a final skim of `design` help/docs/tests.
- [ ] Add a repo hygiene policy for local runtime artifacts so release checks start from a clean worktree.
- [ ] Make `cursor-agent` trust/auth handling either reproducibly diagnosable or reproducibly bootstrappable in clean worktrees.
- [ ] Refactor `genie/src/cli.ts` and `genie/src/cli/parse.ts` into smaller modules with no output-contract regressions.
- [ ] Re-run the full verification suite and update this ExecPlan with outcomes and any follow-up debt.

## Surprises & Discoveries

- Observation: CI already covers more than the older release notes imply.
  Evidence: `.github/workflows/ci.yml` already runs `bun install --frozen-lockfile`, typecheck, test, build, `bun link`, linked-binary help/provider JSON smoke, mocked plain execution, and installed-binary exit-code checks.

- Observation: The repository already ignores both `package-lock.json` files even though those files still exist in the tree.
  Evidence: `.gitignore` contains `package-lock.json` and `/genie/package-lock.json`.

- Observation: The current repo dirtiness problem is no longer lockfiles; it is local agent/runtime artifacts.
  Evidence: `git status --short --branch` shows untracked `.omc/`, `.omcodex/`, and local log files on `main`.

- Observation: `cursor-agent` still relies on the generic provider adapter checks rather than any provider-specific trust diagnostics.
  Evidence: `genie/src/providers/cursor-agent.ts` only defines `buildInvocation` and `parse`; `genie/src/providers/base.ts` falls back to `auth status` for auth checks; `README.md` still documents workspace-trust as a manual prerequisite.

## Decision Log

- Decision: Keep the TD approvals in this ExecPlan as Milestone 0 rather than creating separate ExecPlans for them.
  Rationale: The approvals are low-effort gates that unblock the real technical work and remove stale queue noise.
  Date/Author: 2026-03-08 / Codex

- Decision: Treat repo hygiene, `cursor-agent` hardening, and CLI modularization as one coordinated post-release stream.
  Rationale: These items interact directly with releaseability, maintainability, and future delivery speed, and the release-sweep handoff already groups them as the highest-leverage follow-ups.
  Date/Author: 2026-03-08 / Codex

- Decision: Refactor by extracting stable modules around existing behaviors rather than redesigning the CLI surface.
  Rationale: The goal for the next sprint is maintainability without user-facing churn. Existing tests and docs already codify the command contract.
  Date/Author: 2026-03-08 / Codex

- Decision: If parser modularization proceeds, use a sibling namespace such as `genie/src/cli/parsers/` rather than a `genie/src/cli/parse/` directory.
  Rationale: The top-level `genie/src/cli/parse.ts` coordinator should not share a base name with a same-level directory because that creates an avoidable module-boundary ambiguity.
  Date/Author: 2026-03-08 / Codex

- Decision: Broaden local log ignores only if the repo still has no legitimate tracked `.log` files.
  Rationale: Ignoring `*.log` and common package-manager log patterns is useful for local hygiene, but only if it does not hide intentional project artifacts.
  Date/Author: 2026-03-08 / Codex

## Outcomes & Retrospective

No implementation work has been executed from this ExecPlan yet. Success means the repo ends this stream with both in-review TD tasks closed, a clean local-artifact policy, a narrower or removed `cursor-agent` waiver in release docs, and `genie/src/cli.ts` plus `genie/src/cli/parse.ts` broken into smaller modules while `bun test`, `bun run typecheck`, `bun run build`, and the CI-linked binary contract still pass.

## Context and Orientation

This repository is a TypeScript CLI project rooted at `genie/`. The package manifest is `genie/package.json`. The build uses `tsc -p tsconfig.json`, tests use `vitest run`, and CI installs dependencies with Bun via `bun install --frozen-lockfile`. The executable entrypoint is `genie/src/bin/genie.ts`, which delegates to `genie/src/cli.ts`.

The user-facing command contract is currently implemented in two large files. `genie/src/cli.ts` contains top-level help text, output writers, command dispatch, config/preset loading, and runtime branching for every command. `genie/src/cli/parse.ts` contains global flag parsing, subcommand argument parsing, strict-command fallback logic, and help-topic resolution. Those files are 1113 and 987 lines respectively as of 2026-03-08. The command-specific behavior already lives in smaller modules such as `genie/src/review/command.ts`, `genie/src/design/command.ts`, `genie/src/debug/command.ts`, `genie/src/update/command.ts`, and `genie/src/config/commands.ts`.

Provider integration lives under `genie/src/providers/`. `genie/src/providers/base.ts` provides the generic subprocess runner, default availability/auth probes, timeout handling, and response extraction. `genie/src/providers/cursor-agent.ts` maps a normalized request into a `cursor-agent` subprocess invocation, but it does not currently add any provider-specific availability or trust-status probing. `genie/src/providers/doctor.ts` aggregates provider health data and is the public backend for `genie providers doctor`. `README.md` and `docs/release-checklist.md` document the current known limitation: `cursor-agent` may be installed and visible but still blocked by authentication or workspace trust when run non-interactively in a fresh worktree.

CI is defined in `.github/workflows/ci.yml`. It already validates the installed binary in addition to typechecking, testing, and building. That matters because any refactor in `genie/src/cli.ts` or `genie/src/cli/parse.ts` must preserve behavior for both `bun src/bin/genie.ts ...` and the linked `genie` binary.

Repo hygiene is partly enforced today. The root `.gitignore` ignores generated build artifacts and both `package-lock.json` files, but it does not ignore `.omc/`, `.omcodex/`, or common local log artifacts such as `*.log`, `npm-debug.log*`, `yarn-error.log*`, and `bun-error.log*`. Because release readiness requires a clean worktree, this omission creates recurring noise during local sessions.

TD is the source of truth for workflow state. Right now `td-682e24` (release readiness sweep) and `td-32ae0d` (design subcommand) are in review and can be approved from a different session. This ExecPlan assumes the implementer is not one of the original implementer sessions and can therefore approve them after spot verification.

## Plan of Work

Start by clearing the queue noise. Review `td context td-682e24` and `td context td-32ae0d` one more time, confirm the latest passing evidence still matches the checked-in code, then approve both tasks. While approving `td-682e24`, immediately create fresh TD follow-up items for the remaining technical work if they do not already exist: one for repo hygiene, one for `cursor-agent` hardening, and one for CLI modularization. Do not continue to treat release readiness itself as the active task because release already happened.

Next, fix repo hygiene at the repository boundary. Update `.gitignore` so local session artifacts that are never meant to ship are explicitly ignored. The minimum candidate list is `.omc/`, `.omcodex/`, and local log patterns such as `*.log`, `npm-debug.log*`, `yarn-error.log*`, and `bun-error.log*`, provided no legitimate tracked `.log` files exist in the repo. Keep this change narrow and do not broaden ignores to project files that could plausibly be intentional. After the ignore change, document the policy in the ExecPlan and optionally add one short sentence to `docs/release-checklist.md` only if the cleanup rule materially affects release steps.

Then harden `cursor-agent`. Extend `genie/src/providers/cursor-agent.ts` to provide a provider-specific diagnostic story rather than inheriting only the generic `auth status` behavior from `genie/src/providers/base.ts`. The target behavior is not necessarily automatic trust bootstrap; it is acceptable to conclude that trust cannot be automated safely and instead surface a precise hint that distinguishes three states: binary missing, auth missing, and workspace trust missing. If the provider exposes a better status command than `auth status`, use it; otherwise keep subprocess behavior stable and improve doctor/reporting logic in `genie/src/providers/doctor.ts` and any output formatting touched by `genie/src/cli.ts`. Update tests in `genie/test/providers.doctor.test.ts` and any exit-code or integration tests that assert auth/config failure mapping. Update `README.md` and `docs/release-checklist.md` to reflect the new diagnostic behavior and to remove or narrow the current blanket waiver language.

After the operational work is stable, refactor the oversized CLI surface. In `genie/src/cli.ts`, extract the help text into `genie/src/cli/help.ts`, shared output helpers into `genie/src/cli/output.ts`, and command dispatch handlers into `genie/src/cli/handlers/`. The handler split should mirror the current behavior boundaries: one handler for prompt-driven commands (`run`, `design`, `commit`, `debug`), one for `review`, one for `update`, one for providers, one for config, one for presets, and one for completion/help/version. Keep `genie/src/cli.ts` as a thin orchestration layer that parses argv, dispatches on `parsed.kind`, and maps thrown errors through the existing formatting path.

Perform the same modularization in the parser. Keep `genie/src/cli/parse.ts` as the top-level coordinator/re-export and extract the implementation into a sibling namespace that does not collide with the file name, e.g. `genie/src/cli/parsers/shared.ts`, `genie/src/cli/parsers/prompt.ts`, `genie/src/cli/parsers/review.ts`, `genie/src/cli/parsers/providers.ts`, `genie/src/cli/parsers/config.ts`, `genie/src/cli/parsers/presets.ts`, and `genie/src/cli/parsers/root.ts`. Do not introduce a `genie/src/cli/parse/` directory while retaining `genie/src/cli/parse.ts`; avoid a same-name file/directory module boundary. Preserve the exported `parseArgv` function at the same top-level path so upstream imports do not churn. This is a no-behavior-change refactor: all current parser tests should pass unchanged except where imports are updated, and unit tests should be added or moved alongside the newly isolated parser/handler modules so maintainability improves with the file split.

Finish by re-running the full test/build suite, plus the linked binary smoke and targeted `cursor-agent` diagnostics tests. Update this ExecPlan's Progress, Surprises & Discoveries, Decision Log, and Outcomes & Retrospective with the actual results and any deviations.

## Milestones

### Milestone 0: Clear review debt and create clean follow-up ownership

At the end of this milestone, there are no stale in-review TD items masking the actual roadmap. `td-682e24` and `td-32ae0d` are approved, and the remaining technical work exists as active follow-up tasks with clear scope. Verification is administrative but observable: `td reviewable` should no longer list those two items.

### Milestone 1: Make the repository clean by default and make `cursor-agent` diagnosable

At the end of this milestone, a normal local session does not create surprising untracked files in `git status`, and `genie providers doctor --provider cursor-agent --json` produces actionable guidance in fresh worktrees. Acceptance is visible via `git status --short --branch`, provider doctor output, and updated release docs that no longer rely on vague waiver language.

### Milestone 2: Modularize the CLI entrypoint without changing behavior

At the end of this milestone, `genie/src/cli.ts` and `genie/src/cli/parse.ts` are reduced to orchestration roles, new command/help/parser modules exist at stable paths, and the full test suite still passes. Acceptance is observable through file sizes, preserved help output, unchanged JSON envelopes, green verification commands, and new unit coverage for the extracted parser/handler modules.

## Concrete Steps

Run these commands from the repository root unless a different directory is stated.

1. Reconfirm current review state and approve the two in-review tasks.

```bash
cd /Users/dallascrilley/Code/cli-projects/genie-cli
td context td-682e24
td context td-32ae0d
td approve td-682e24
td approve td-32ae0d
td reviewable
```

Expected result: the first two commands show completed handoffs; the two `approve` commands succeed; `td reviewable` no longer lists those IDs.

2. Capture or create the follow-up TD tasks for this ExecPlan if they do not already exist.

```bash
cd /Users/dallascrilley/Code/cli-projects/genie-cli
td list --limit 20
# If needed:
td add "Ignore local agent/runtime artifacts in genie-cli" --minor
td add "Harden cursor-agent trust/auth diagnostics for release worktrees" --minor
td add "Modularize cli.ts and cli/parse.ts without behavior changes" --minor
```

Expected result: the list shows explicit successor items rather than an open-ended release task.

3. Implement repo hygiene and inspect the changed worktree.

```bash
cd /Users/dallascrilley/Code/cli-projects/genie-cli
git status --short --branch
```

Expected result after the `.gitignore` change: `.omc/`, `.omcodex/`, and local log artifacts no longer appear as untracked noise.

4. Validate provider diagnostics locally.

```bash
cd /Users/dallascrilley/Code/cli-projects/genie-cli/genie
bun test
bun run typecheck
bun run build
node dist/bin/genie.js providers doctor --provider cursor-agent --json
```

Expected result: tests, typecheck, and build pass; provider doctor returns a stable JSON envelope with a more specific `hint` or detail path for `cursor-agent`.

5. Validate the linked-binary contract and startup/build output shape after the refactor.

```bash
cd /Users/dallascrilley/Code/cli-projects/genie-cli/genie
bun link
export PATH="$HOME/.bun/bin:$PATH"
genie --help >/tmp/genie-help.txt
grep -q "Unified AI CLI" /tmp/genie-help.txt
genie providers list --json >/tmp/genie-providers.json
time node dist/bin/genie.js --help
ls -la dist/cli/
```

Expected result: the linked binary still exposes the same help header and JSON provider inventory shape, startup remains fast enough to feel instantaneous in local use (treat anything noticeably slower than the current baseline as a regression to investigate), and the compiled CLI module layout under `dist/cli/` still looks coherent after the split.

## Validation and Acceptance

Accept this ExecPlan's work only if all of the following are true:

- TD queue acceptance: `td reviewable` no longer contains `td-682e24` or `td-32ae0d`, and successor tasks exist for any remaining work.
- Repo hygiene acceptance: a normal `git status --short --branch` in the repo root does not show `.omc/`, `.omcodex/`, or local log artifacts as untracked artifacts.
- Provider diagnostics acceptance: `genie providers doctor --provider cursor-agent --json` distinguishes unavailable/auth/trust failure modes clearly enough that a fresh worktree operator can tell what to fix.
- CLI modularization acceptance: `genie/src/cli.ts` and `genie/src/cli/parse.ts` are materially smaller, and their responsibilities are limited to orchestration rather than large embedded help or parsing logic blocks.
- Extracted-module test acceptance: unit tests exist for the newly isolated parser and handler modules in addition to the existing CLI integration suite.
- Regression acceptance: from `genie/`, `bun test`, `bun run typecheck`, and `bun run build` all pass.
- Installed-binary acceptance: after `bun link`, `genie --help` and `genie providers list --json` still pass exactly as CI expects.

Human-observable success examples:

- Running `genie help review` prints the same guidance as before the refactor.
- Running `genie review --json-schema` still succeeds.
- Running `genie providers doctor --provider cursor-agent --json` returns a JSON object whose failure explanation is more precise than a generic auth error.

## Idempotence and Recovery

Approving TD tasks is not reversible, so verify the handoff contexts before running `td approve`. That is the only non-idempotent step in this plan. If a task should not be approved, reject it with a concise reason and leave a new TD task for the remediation instead of silently continuing.

Most file-system work in this plan is idempotent. Adding ignore rules can be re-run safely. Refactoring modules can be repeated incrementally as long as the exported `parseArgv` and CLI entrypoint stay stable. Provider diagnostics changes are safe to iterate because they only affect local code and tests.

If the CLI refactor destabilizes behavior, recover by restoring the previous module boundary through normal git edits rather than destructive resets, then re-run `bun test`, `bun run typecheck`, and `bun run build` to identify the smallest failing seam. If linked-binary smoke fails after `bun link`, inspect `dist/bin/genie.js` and re-run `bun run build` before touching CI configuration.

## Interfaces and Dependencies

The work in this ExecPlan should preserve these stable interfaces while allowing internal reorganization:

    In genie/src/cli.ts, keep:

        export { parseArgv } from './cli/parse.js'

    and the top-level async CLI entrypoint used by genie/src/bin/genie.ts.

    In genie/src/cli/help.ts, define:

        export function usage(topic?: HelpTopic): string

    In genie/src/cli/output.ts, define helpers for writing human text, verbose diagnostics,
    JSON envelopes, and cancellations so handlers stop duplicating output logic.

    In genie/src/cli/handlers/prompt.ts, define a handler that covers the shared run-like
    execution path used by `run`, `design`, `commit`, and `debug`, while allowing each command
    to inject its prompt/input builder.

    In genie/src/cli/parsers/shared.ts, define:

        export function defaultGlobals(): GlobalOptions
        export function parseGlobalFlag(token: string, globals: GlobalOptions): boolean
        export function defaultMutationSafety(): MutationSafetyOptions
        export function parseMutationFlag(token: string, safety: MutationSafetyOptions): boolean

    In genie/src/cli/parse.ts, keep the stable top-level coordinator/re-export:

        export { parseArgv } from './parsers/root.js'

    In genie/src/cli/parsers/root.ts, keep the single parser coordinator:

        export function parseArgv(argv: string[]): ParsedCommand

    In genie/src/providers/cursor-agent.ts, extend the adapter creation to use either:

        availabilityCheck?: (runner: CommandRunner) => Promise<ProviderCheckResult>
        authCheck?: (runner: CommandRunner) => Promise<ProviderCheckResult>

    as supported by `createProviderAdapter` in `genie/src/providers/base.ts`.

Use existing dependencies only: Node subprocess APIs, TypeScript, Vitest, and the repo's current provider abstractions. Do not add new third-party libraries for this stream.

## Artifacts and Notes

Current evidence snapshots worth preserving during implementation:

    Snapshot as of 2026-03-08: the latest CI run on `main` succeeded and already includes linked-binary smoke.

    `git status --short --branch` currently reports:

        ## main...origin/main
        ?? .omc/
        ?? .omcodex/
        ?? error.log

    Current file sizes:

        1113 genie/src/cli.ts
         987 genie/src/cli/parse.ts

    Current provider note in README:

        cursor-agent: installed plus authenticated and trusted for the current workspace; non-interactive checks may surface a workspace-trust prompt until that directory is approved

## Revision History

- 2026-03-08: Initial ExecPlan created from current TD, git, CI, README, release-checklist, and source-file evidence.
