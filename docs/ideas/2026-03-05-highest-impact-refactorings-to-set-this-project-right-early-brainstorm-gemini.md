# High-Impact Refactoring Brainstorm: Highest impact refactorings to set this project right early

## Focus Summary

- **Purpose:** The `genie-cli` orchestrates various LLM providers (Codex, Claude, Gemini, Cursor) to execute prompts and review code via terminal operations.
- **Key Flows:** Request normalization -> Provider selection/fallback -> Subprocess execution -> Output formatting/Telemetry.
- **Current Technical Debt Indicators:**
  - *Complexity Hotspots:* `cli.ts` uses a monolithic `executeCommand` router with deeply nested `if/else` conditionals. `review/command.ts` mixes Git domain logic with parallel LLM execution.
  - *Coupling:* Ad-hoc `CommandRunner` dependency passing via optional arguments (e.g., `runCommand`) across the stack.
  - *Error-Prone Logic:* `providers/base.ts` manually manages subprocess timeouts with `setTimeout` and nested `kill()` sequences instead of leveraging native signals.
  - *Hardcoded Strings:* Help text is manually maintained as giant string arrays, leading to drift from actual implementation.
- **Constraints:** Must maintain exact CLI usage, output modes (JSON, plain, etc.), and process exit codes to prevent CI/CD breakages.
- **Risks/Unknowns:** Modifying provider sub-processes (`spawn` in `runCommand`) runs the risk of creating zombie processes if not handled correctly.

---

## Candidate Brainstorm (Unfiltered)

1. **Extract `GitService`:** Move all child_process git operations (`safeGitRead`, `resolveGitContext`) out of `review/command.ts` to reduce duplication and enable pure-logic testing.
2. **Modernize Subprocess Timeouts:** Replace manual `setTimeout`/`kill` logic in `providers/base.ts` with `AbortController` and `AbortSignal.timeout()`.
3. **Refactor `cli.ts` to Command Pattern:** Replace the massive `if (parsed.kind === ...)` block with a registry of command objects.
4. **Implement Lazy-Loading:** Defer `import` of heavy modules (like review/update/providers) until the command is routed, improving CLI startup performance.
5. **Centralized Dependency Injection:** Replace the manual `runner` parameter passing with a lightweight DI container or React-like Context for the CLI context.
6. **Declarative Provider Pipeline:** Refactor `executeWithFallback` into a Chain of Responsibility pattern instead of an imperative `for` loop that mutates `failures` and `attempts` arrays.
7. **Schema-Driven Help Text:** Auto-generate CLI usage text from `cli/parse.ts` Zod/Type definitions instead of hardcoded strings.
8. **Extract Telemetry/Timing from Execution:** Separate the tracking of `durationMs` and `attempts` from the core provider fallback logic into a wrapper or middleware.
9. **Consolidate Error Handling:** Create a standardized error boundary at the CLI entry point rather than ad-hoc `instanceof Error` checks spread across `review` and `providers`.
10. **Refactor Output Formatters:** Extract the repetitive `shouldUseJson` and formatting logic from `cli.ts` into a dedicated `OutputService`.

---

## Top Refactoring Tasks (Ranked)

| # | ID | Title | Cat. | Impact | Effort | Exp. | Risk | Novelty | Priority | Targets / Search |
|---:|---|---|---|---:|---:|---:|---:|---:|---:|---|
| 1 | REF-001 | Replace manual timeouts with AbortController | Conventional | 4 | 2 | 3 | 2 | 2 | 2.00 | `genie/src/providers/base.ts`, `setTimeout`, `kill('SIGTERM')` |
| 2 | REF-002 | Extract GitService from review command | Conventional | 4 | 2 | 2 | 2 | 1 | 2.00 | `genie/src/review/command.ts`, `execFileSync('git'`, `safeGitRead` |
| 3 | REF-003 | Implement lazy-loading for CLI commands | Conventional | 3 | 2 | 3 | 2 | 2 | 1.50 | `genie/src/cli.ts`, `import { ... }` |
| 4 | REF-004 | Refactor `cli.ts` router to Command Pattern | Conventional | 4 | 3 | 3 | 3 | 2 | 1.33 | `genie/src/cli.ts`, `executeCommand`, `if (parsed.kind ===` |
| 5 | REF-005 | Declarative Provider Execution Pipeline | Creative | 4 | 3 | 4 | 3 | 4 | 1.33 | `genie/src/execution/fallback.ts`, `executeWithFallback`, `for (const providerId of params.order)` |
| 6 | REF-006 | Introduce Lightweight DI Container for CLI | Moonshot | 5 | 4 | 4 | 4 | 4 | 1.25 | `genie/src/**/*.ts`, `runner: CommandRunner` |
| 7 | REF-007 | Schema-driven CLI help text generation | Creative | 3 | 3 | 3 | 2 | 4 | 1.00 | `genie/src/cli.ts`, `function usage(topic?: HelpTopic)` |

### Rationale for #1
Replacing manual, timer-based process killing with native Node.js `AbortController` and signals offers an immediate reduction in error-prone boilerplate and prevents zombie processes. It significantly increases code reliability with a relatively small, isolated footprint.

---

## Epics & Task Details

### EPIC-01: Execution Reliability & Modularity
**Tasks:** REF-001, REF-005

**REF-001: Replace manual timeouts with AbortController**
- **Type:** `"refactor"`
- **Area:** `"backend"`
- **Owner Role:** `"BE"`
- **Scope:** `genie/src/providers/base.ts` (`runCommand`)
- **Current State:** `runCommand` manually establishes a `setTimeout`, checks a `didResolve` flag, and issues nested `kill('SIGTERM')` / `kill('SIGKILL')` calls which is complex and leak-prone.
- **Implementation Steps:**
  1. Instantiate an `AbortController` or use `AbortSignal.timeout(invocation.timeoutMs)`.
  2. Pass the `signal` option to the `spawn` configuration.
  3. Remove manual `setTimeout` and cleanup logic.
  4. Handle the `AbortError` or native timeout event in the `error` listener.
- **Acceptance Criteria:**
  - [ ] Timeouts correctly terminate child processes.
  - [ ] No `setTimeout` used for process termination.
  - [ ] "No behavior changes" verified via executing existing timeout integration tests.
- **Test Plan:** Verify with existing `providers.base.test.ts` focusing on execution timeout scenarios.
- **Expected Improvements:** Eliminates race conditions and edge cases in subprocess termination.

**REF-005: Declarative Provider Execution Pipeline**
- **Type:** `"refactor"`
- **Area:** `"backend"`
- **Owner Role:** `"Fullstack"`
- **Scope:** `genie/src/execution/fallback.ts` (`executeWithFallback`)
- **Current State:** The fallback loop interleaves domain logic, performance timing, preflight checks, and aggregate error building in one large `for` loop.
- **Implementation Steps:**
  1. Define a middleware signature (e.g., `(req, next) => Promise<Result>`).
  2. Extract preflight, timing measurement, and error aggregation into separate middleware handlers.
  3. Refactor `executeWithFallback` to construct a chain of responsibility.
  4. Pass the request through the chain.
- **Acceptance Criteria:**
  - [ ] Fallback logic is purely handled by a resolver or iterator.
  - [ ] Timing metrics are captured independently of provider execution logic.
  - [ ] "No behavior changes" verified via test suite pass.
- **Test Plan:** Run `execution.fallback.test.ts` and `fallback.telemetry.test.ts`.
- **Targets/Search:** `executeWithFallback`
- **Expected Improvements:** Reduces cyclomatic complexity and simplifies adding new provider execution hooks (like caching or logging).
- **Experiment (Creative):** Timeboxed (2h) creation of a middleware pipeline for `executeWithFallback`.
- **Success Metric:** Shorter function length in `fallback.ts` without failing any existing telemetry tests.
- **Rollback Plan:** Revert to the existing `for` loop.

### EPIC-02: Structural Separation of Concerns
**Tasks:** REF-002, REF-004

**REF-002: Extract GitService from review command**
- **Type:** `"refactor"`
- **Area:** `"backend"`
- **Owner Role:** `"BE"`
- **Scope:** `genie/src/review/command.ts`
- **Current State:** Git operations (`safeGitRead`, `resolveGitContext`, diff resolutions) are hardcoded inside the review command module.
- **Implementation Steps:**
  1. Create `genie/src/services/git.ts`.
  2. Extract `safeGitRead`, `resolveGitContext`, `buildBaseRefCandidates`, and `loadHeadDiffWithUnbornFallback`.
  3. Export a clear interface (e.g., `GitService`) that can be instantiated or imported.
  4. Update `command.ts` to inject or import `GitService`.
- **Acceptance Criteria:**
  - [ ] All `execFileSync('git', ...)` calls are moved out of `review/command.ts`.
  - [ ] "No behavior changes" verified via executing CLI tests.
- **Test Plan:** Execute `review.command.test.ts` and `cli.review-json.integration.test.ts`.
- **Targets/Search:** `execFileSync`, `safeGitRead`, `GitReadFn`
- **Expected Improvements:** Separates I/O side effects from business logic, massively improving testability.

**REF-004: Refactor `cli.ts` router to Command Pattern**
- **Type:** `"refactor"`
- **Area:** `"backend"`
- **Owner Role:** `"BE"`
- **Scope:** `genie/src/cli.ts`
- **Current State:** `executeCommand` is a massive function with 11+ `if (parsed.kind === ...)` conditionals.
- **Implementation Steps:**
  1. Define a `Command` interface with `execute(parsed, config): Promise<void>`.
  2. Extract each block in `executeCommand` into its own file in a new `commands/` directory or dictionary.
  3. Refactor `executeCommand` to look up the registered command handler by `parsed.kind` and execute it.
- **Acceptance Criteria:**
  - [ ] `executeCommand` has no nested `if (parsed.kind === ...)` routing blocks.
  - [ ] "No behavior changes" verified by full CLI integration test pass.
- **Test Plan:** Ensure `cli.exit-codes.integration.test.ts` passes.
- **Targets/Search:** `executeCommand`, `if (parsed.kind ===`
- **Expected Improvements:** Open-closed principle alignment—new commands can be added without mutating the root CLI router.

### EPIC-03: Architectural Re-Alignment
**Tasks:** REF-006

**REF-006: Introduce Lightweight DI Container for CLI**
- **Type:** `"refactor"`
- **Area:** `"backend"`
- **Owner Role:** `"BE"`
- **Scope:** Global (`genie/src/**/*.ts`)
- **Current State:** `CommandRunner` and `GenieConfig` are passed sequentially through multiple function signatures, cluttering APIs.
- **Implementation Steps:**
  1. Create a simple Context or IoC container.
  2. Initialize the container in `genie.ts` / `cli.ts` with the default `runCommand` and loaded config.
  3. Remove `runner: CommandRunner` optional parameters from `executeWithFallback`, `runRequest`, `isAvailable`, etc.
  4. Resolve dependencies from the container inside function implementations.
- **Acceptance Criteria:**
  - [ ] Functions no longer accept `runner` or drill `config` deeply unless strictly necessary.
  - [ ] "No behavior changes" verified across the entire test suite.
- **Test Plan:** Comprehensive run of all `integration.test.ts` files.
- **Targets/Search:** `runner?: CommandRunner`, `runWithRunner`
- **Expected Improvements:** Clean APIs, less parameter drilling, and centralized mocking for unit tests.
- **Experiment (Moonshot):** 2 hour proof-of-concept integrating a lightweight functional DI container.
- **Success Metric:** Successful execution of the main `genie run` command with zero drilled runner parameters.
- **Rollback Plan:** Drop the DI branch and revert parameter definitions.

### EPIC-04: CLI Performance & DX
**Tasks:** REF-003, REF-007

**REF-003: Implement lazy-loading for CLI commands**
- **Type:** `"perf"`
- **Area:** `"backend"`
- **Owner Role:** `"BE"`
- **Scope:** `genie/src/cli.ts`
- **Current State:** All command modules and heavy sub-dependencies (e.g., config loaders, network providers) are imported at the top of the entrypoint file.
- **Implementation Steps:**
  1. Identify heavy imports in `cli.ts`.
  2. Move imports inside the respective command handler blocks (or use async dynamic `import()`).
  3. Ensure synchronous paths (like `--help` and `--version`) do not trigger node module compilation for providers.
- **Acceptance Criteria:**
  - [ ] `genie --version` and `genie --help` execution times are significantly reduced.
  - [ ] "No behavior changes" verified.
- **Test Plan:** Compare `time genie --help` before and after; run `cli.parser.test.ts`.
- **Targets/Search:** Top-level `import` declarations in `genie/src/cli.ts`.
- **Expected Improvements:** Drastic reduction in CLI startup latency for quick operations.

**REF-007: Schema-driven CLI help text generation**
- **Type:** `"DX"`
- **Area:** `"backend"`
- **Owner Role:** `"BE"`
- **Scope:** `genie/src/cli.ts`, `genie/src/cli/parse.ts`
- **Current State:** The `usage()` function returns manually structured strings that duplicate flags defined in the argument parser.
- **Implementation Steps:**
  1. Annotate the parser definitions in `cli/parse.ts` with descriptive help text.
  2. Implement a generator function that builds the usage strings dynamically from the parser schema.
  3. Replace the static string arrays in `cli.ts` -> `usage()`.
- **Acceptance Criteria:**
  - [ ] Help text is generated directly from code configurations.
  - [ ] Output format looks identical (or cleaner) than the hardcoded version.
  - [ ] "No behavior changes" verified against existing help output.
- **Test Plan:** Manual visual test of `genie --help` across subcommands.
- **Targets/Search:** `function usage(topic?: HelpTopic): string`
- **Expected Improvements:** Eliminates documentation drift when adding new CLI flags.
- **Experiment (Creative):** Timebox 2h to write a string builder that maps from the internal schema.
- **Success Metric:** Dynamic generation of `genie run --help` that matches the old static text.
- **Rollback Plan:** Revert to static string definitions.