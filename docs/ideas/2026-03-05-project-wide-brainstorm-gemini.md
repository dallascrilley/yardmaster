# Refactoring Brainstorm: Project-wide (2026-03-05)

## Focus Summary

The `genie-cli` project is a TypeScript-based CLI tool for interacting with various AI providers (Claude, Codex, Gemini, etc.). It features a command-line interface with subcommands like `run`, `review`, `config`, `presets`, and `providers`.

### Key Flows
- **CLI Parsing:** Tokens are manually iterated and mapped to command kinds.
- **Config Management:** Hierarchical merging of defaults, user config, project config, environment variables, and CLI flags.
- **Request Execution:** Prompting providers through specialized adapters with fallback logic.

### Current Technical Debt Indicators
- **Big Switch Antipattern:** `cli.ts` and `parse.ts` contain massive, nested conditional blocks for command execution and parsing.
- **Duplicated Output Logic:** JSON/Plain text formatting is repeated across almost every command handler.
- **Brittle Parsing:** Manual token iteration in `parse.ts` is error-prone and hard to extend.
- **Config Transformation Bloat:** Mapping flags and environment variables to config structures is duplicated and inconsistent.
- **Manual Process Management:** `runCommand` in `base.ts` manually manages `spawn` and timeouts, leading to complex state management.

## Candidate Brainstorm (Unfiltered)

- **REF-001: Implement Command Registry & Strategy Pattern** (Refactor) - Decouple command logic from `cli.ts`.
- **REF-002: Centralize Configuration Mapping Logic** (Refactor) - Unified `ConfigBuilder` for env/flag/preset merging.
- **REF-003: Introduce a Unified Output Manager** (Refactor/DX) - Abstract stdout/stderr and JSON formatting.
- **REF-004: Declarative CLI Argument Parser** (Refactor/DX) - Schema-based parsing to replace manual token loops.
- **REF-005: Clean Process Execution Utility** (Refactor) - Simplify `runCommand` using a cleaner async wrapper.
- **REF-006: Dynamic Provider Registry** (Refactor) - Decouple core from hardcoded provider lists.
- **REF-007: Global Error Handling Middleware** (Refactor) - Reduce `try-catch` repetition.
- **REF-008: Advanced Zod Integration for Config** (Refactor) - Use Zod's `default` and `transform` more effectively.
- **REF-009: Decouple TTY State from Logic** (Refactor) - Dependency injection for TTY and environment info.
- **REF-010: Moonshot: Plugin-based Provider Architecture** (Moonshot/Refactor) - Allow loading providers dynamically.
- **REF-011: Moonshot: Interactive Configuration Wizard** (Creative/DX) - Refactor `config init` into a rich interactive flow.
- **REF-012: Performance: Lazy Load Providers** (Perf/Refactor) - Only import/initialize providers when needed.
- **REF-013: Creative: DSL for Provider Invocations** (Creative) - Define provider CLI mappings using a declarative DSL.
- **REF-014: Standardize Result Envelopes** (Refactor) - Unify response/error structures across all commands.
- **REF-015: Flatten `types.ts` into Domain Modules** (Refactor) - Move types closer to their implementations.
- **REF-016: Extract Preset Resolution Logic** (Refactor) - Move preset merging out of `cli.ts`.
- **REF-017: Improve Testability via DI** (Refactor) - Inject `fs`, `process`, and `spawn` for easier mocking.
- **REF-018: Implement a Command Pre-flight Check** (Refactor) - Validate environment/auth once before any command execution.
- **REF-019: Moonshot: Rust-based Core for Performance** (Moonshot/Perf) - Rewrite core logic in Rust for speed.
- **REF-020: Refactor `UsageError` to include Context** (Refactor) - Include hints and help topics directly in errors.

## Top Refactoring Tasks (Ranked)

| # | ID | Title | Cat. | Impact | Effort | Exp. | Risk | Novelty | Priority | Targets / Search |
|---:|---|---|---|---:|---:|---:|---:|---:|---:|---|
| 1 | REF-001 | Implement Command Registry & Strategy Pattern | Conventional | 5 | 3 | 3 | 2 | 2 | 1.67 | `if (parsed.kind ===`, `cli.ts` |
| 2 | REF-003 | Introduce a Unified Output Manager | Conventional | 4 | 2 | 2 | 1 | 2 | 2.00 | `shouldUseJson`, `writeJson` |
| 3 | REF-002 | Centralize Configuration Mapping Logic | Conventional | 4 | 3 | 3 | 3 | 2 | 1.33 | `store.ts`, `envConfigFromProcess` |
| 4 | REF-004 | Declarative CLI Argument Parser | Creative | 4 | 4 | 4 | 3 | 4 | 1.00 | `parse.ts`, `tokens[index]` |
| 5 | REF-012 | Performance: Lazy Load Providers | Conventional | 3 | 2 | 2 | 1 | 3 | 1.50 | `providers/registry.ts` |
| 6 | REF-005 | Clean Process Execution Utility | Conventional | 3 | 2 | 3 | 3 | 2 | 1.50 | `runCommand`, `spawn` |
| 7 | REF-013 | Creative: DSL for Provider Invocations | Creative | 3 | 4 | 4 | 2 | 5 | 0.75 | `buildInvocation`, `providers/*.ts` |
| 8 | REF-010 | Moonshot: Plugin-based Provider Architecture | Moonshot | 5 | 5 | 5 | 4 | 5 | 1.00 | `providerAdapters`, `registry.ts` |

## Rationale for #1

**REF-001 (Command Registry)** provides the best impact/effort ratio because it directly addresses the largest maintenance bottleneck: the 200+ line `executeCommand` function in `cli.ts`. Breaking this "Big Switch" into discrete, testable command modules improves readability, reduces the risk of accidental side effects, and makes the system significantly more extensible for future features.

## Notes / Assumptions
- Assumes that "no behavior changes" allows for significant internal restructuring as long as CLI outputs and exit codes remain identical.
- Current tests provide enough coverage to verify that refactoring doesn't break existing functionality.

---

### Epic: Grouping Refactorings
- **EPIC-01: Core CLI Decoupling** (REF-001, REF-003, REF-004)
- **EPIC-02: Configuration Engine Overhaul** (REF-002, REF-008, REF-016)
- **EPIC-03: Provider Infrastructure & Performance** (REF-005, REF-012, REF-010)

---

### REF-001: Implement Command Registry & Strategy Pattern
- **type:** `refactor`
- **area:** `backend`
- **owner_role:** `Fullstack`
- **current state:** `executeCommand` in `cli.ts` is a massive `if-else` chain that handles parsing results, loading configs, and formatting outputs for 10+ subcommands.
- **expected improvements:** Significant reduction in `cli.ts` file size, improved test isolation, and easier subcommand extension.
- **implementation steps:**
  1. Define a `Command` interface with `execute(context: CommandContext): Promise<void>`.
  2. Create a `CommandRegistry` that maps `CommandKind` to `Command` implementations.
  3. Extract each `if` block from `executeCommand` into a separate file in `src/commands/`.
  4. Refactor `cli.ts` to simply lookup and run the appropriate command.
- **acceptance criteria:**
  - [ ] All subcommands function identically to current state.
  - [ ] `cli.ts` contains no subcommand-specific logic.
  - [ ] Unit tests pass for each extracted command.
  - [ ] "no behavior changes" verified via integration tests.
- **test plan:**
  - Level: Integration/Unit
  - Location: `test/commands/*.test.ts`
- **experiment category:** "none"

### REF-003: Introduce a Unified Output Manager
- **type:** `refactor`
- **area:** `backend`
- **owner_role:** `BE`
- **current state:** Duplicated `if (shouldUseJson) { writeJson(x) } else { writeLine(y) }` patterns scattered across `cli.ts` and command-handling files.
- **expected improvements:** Centralized output formatting, easier addition of new formats (e.g., YAML), and cleaner command implementations.
- **implementation steps:**
  1. Create `src/runtime/output.ts` with an `OutputManager` class.
  2. Implement `format(data: unknown, options: OutputOptions): string`.
  3. Inject `OutputManager` into command handlers.
  4. Replace manual `process.stdout.write` calls with `output.write(data)`.
- **acceptance criteria:**
  - [ ] JSON and Plain outputs are identical to current state.
  - [ ] `--json` flag works consistently across all commands.
  - [ ] No direct `JSON.stringify` calls in command handlers.
  - [ ] "no behavior changes" verified.
- **test plan:**
  - Level: Unit
  - Location: `test/runtime.output.test.ts`
- **experiment category:** "none"

### REF-004: Declarative CLI Argument Parser
- **type:** `refactor`
- **area:** `backend`
- **category:** `Creative`
- **owner_role:** `Fullstack`
- **current state:** `parse.ts` uses manual `for` loops and `index += 1` increments to parse tokens, which is fragile and verbose.
- **expected improvements:** More readable parser, automatic help generation, and easier addition of new flags.
- **implementation steps:**
  1. Define a schema for each subcommand's arguments and flags.
  2. Implement a generic `SchemaParser` that matches tokens against the schema.
  3. Refactor `parseArgv` to use the schema-based approach.
  4. Ensure compatibility with current "loose" parsing (e.g., `genie prompt` vs `genie run prompt`).
- **acceptance criteria:**
  - [ ] All existing argument combinations parse correctly.
  - [ ] Invalid arguments throw `UsageError` as expected.
  - [ ] Parser code is 50% smaller and more declarative.
  - [ ] "no behavior changes" verified.
- **test plan:**
  - Level: Unit
  - Location: `test/cli.parser.test.ts`
- **experiment category:** "creative"
- **small experiment:** Create a schema for the `config` subcommand and verify it passes existing parser tests.
- **success metric:** 100% pass rate on existing parser tests with zero manual token manipulation for the test case.
- **rollback plan:** Revert `parse.ts` to the previous manual token iteration logic.

### REF-012: Performance: Lazy Load Providers
- **type:** `perf`
- **area:** `backend`
- **owner_role:** `BE`
- **current state:** All provider adapters are imported and initialized in `registry.ts` regardless of which one is used.
- **expected improvements:** Faster CLI startup time (reduced cold start) by only loading required modules.
- **implementation steps:**
  1. Refactor `providerAdapters` in `registry.ts` to be an object of dynamic imports.
  2. Implement an `async getProvider(id: ProviderId)` function.
  3. Update `runRequest` and `executeWithFallback` to use the lazy loader.
- **acceptance criteria:**
  - [ ] CLI still functions correctly for all providers.
  - [ ] Startup time (for simple commands like `version`) is reduced.
  - [ ] No regressions in fallback behavior.
  - [ ] "no behavior changes" verified.
- **test plan:**
  - Level: Unit
  - Location: `test/providers.registry.test.ts`
- **experiment category:** "none"

### REF-010: Moonshot: Plugin-based Provider Architecture
- **type:** `refactor`
- **area:** `backend`
- **category:** `Moonshot`
- **owner_role:** `Fullstack`
- **current state:** Providers are hardcoded in the codebase, making it impossible for users to add their own without modifying the source.
- **expected improvements:** Extensibility for new AI providers without core changes, cleaner separation of concerns.
- **implementation steps:**
  1. Define a `GenieProviderPlugin` interface.
  2. Implement a plugin loader that can load `.js` files from a `~/.config/genie/plugins` directory.
  3. Refactor core provider logic to treat internal providers as "built-in" plugins.
  4. Update `registry.ts` to merge built-in and external plugins.
- **acceptance criteria:**
  - [ ] Built-in providers work as before.
  - [ ] A sample external provider plugin can be loaded and used.
  - [ ] Plugin errors are gracefully handled and don't crash the CLI.
  - [ ] "no behavior changes" verified for core paths.
- **test plan:**
  - Level: Integration
  - Location: `test/plugins.integration.test.ts`
- **experiment category:** "moonshot"
- **small experiment:** Try loading one existing provider (e.g., `claude.ts`) dynamically instead of statically.
- **success metric:** Dynamic loading of a provider doesn't increase latency by more than 50ms and maintains all functionality.
- **rollback plan:** Keep providers as static imports in `registry.ts`.
