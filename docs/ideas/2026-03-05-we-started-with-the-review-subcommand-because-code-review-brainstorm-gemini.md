# New Subcommands Brainstorm: Expanding from Review to the Next High-Impact Workflow

## Focus Summary

- **Purpose:** Determine the next high-value CLI subcommands for `genie` following the success of the `review` feature. The goal is to provide developers with immediate, terminal-native AI capabilities that solve real daily pain points.
- **Key Flows:** User triggers `genie <subcommand> [args]` -> CLI parses context (git, files, or stdin) -> AI provider evaluates -> CLI outputs actionable text or writes to disk.
- **Constraints:** Features must leverage the existing provider fallback system, support multiple models if beneficial, and respect the terminal environment (clean stdout/stderr).
- **Risks/Unknowns:** Preventing CLI bloat by selecting features with the highest generic utility rather than project-specific niche capabilities.

---

## Candidate Brainstorm (Unfiltered)

1. **`genie commit`**: Auto-generate conventional commit messages based on `git diff --staged`. (Solves common user pain point of writing good commit messages).
2. **`genie brainstorm`**: Generate 5-10 distinct architectural or implementation ideas for a given prompt, using multiple models.
3. **`genie debug`**: Pipe `stderr` or a crash log into the CLI to get a root cause analysis and a proposed fix. (Unlocks new use case).
4. **`genie plan`**: Convert a brief feature request into a step-by-step markdown implementation plan/checklist. (Improves user productivity).
5. **`genie test`**: Auto-generate unit tests for a specific file or function and output them to the correct test directory.
6. **`genie explain`**: Explain a complicated regex, bash command, or source file in plain English.
7. **`genie refactor`**: Propose and optionally apply a refactor for a targeted code block to improve readability or performance.
8. **`genie document`**: Automatically generate JSDoc/TSDoc comments for an entire file.
9. **`genie roast`**: Provide a humorous, critical, and brutally honest review of the codebase or a specific PR. (Enhances user experience/delight).
10. **`genie chat`**: Enter a stateful interactive REPL session with the AI, retaining history in the terminal.
11. **`genie synth`**: Synthesize a new feature across multiple files simultaneously (e.g., creating a frontend view, backend controller, and database migration in one go). (Creates competitive differentiation).
12. **`genie auto-fix`**: Automatically run the project's test suite, capture failures, and attempt to fix them without user intervention.
13. **`genie optimize`**: Profile a file and suggest explicit performance optimizations.
14. **`genie security`**: Run a static security audit on the current branch using a specialized prompt.
15. **`genie name`**: Provide a list of highly contextual variable, function, or project names based on a brief description.
16. **`genie tldr`**: Summarize a long markdown document or API response in a single sentence.
17. **`genie translate`**: Convert a snippet of code from one programming language to another.
18. **`genie align`**: Rewrite a file to strictly match the formatting and style conventions found in another reference file.
19. **`genie predict`**: Analyze recent git history and predict where the next bug or regression is most likely to occur.
20. **`genie scaffold`**: Generate boilerplate code for a new module or project based on a plain English description.

---

## Top Features (Ranked)

| # | ID | Title | Cat. | Impact | Effort | Exp. | Risk | Novelty | Priority | Targets / Search |
|---:|---|---|---|---:|---:|---:|---:|---:|---:|---|
| 1 | FEAT-001 | Auto-Generate Git Commit Messages | Conventional | 5 | 2 | 2 | 1 | 2 | 2.50 | `genie commit`, `git diff --staged` |
| 2 | FEAT-002 | Multi-Model Brainstorming | Creative | 4 | 2 | 2 | 1 | 4 | 2.00 | `genie brainstorm`, `Promise.all(providers)` |
| 3 | FEAT-003 | Terminal Error Debugger | Conventional | 5 | 3 | 3 | 2 | 2 | 1.67 | `genie debug`, `stdin`, `stderr` |
| 4 | FEAT-004 | Codebase "Roast" Mode | Creative | 3 | 2 | 2 | 2 | 5 | 1.50 | `genie roast`, `system prompt` |
| 5 | FEAT-005 | Task Planning from Prompt | Conventional | 4 | 3 | 3 | 2 | 2 | 1.33 | `genie plan`, `markdown checklist` |
| 6 | FEAT-006 | Intelligent Test Generation | Conventional | 4 | 3 | 3 | 2 | 2 | 1.33 | `genie test`, `*.test.ts`, `vitest` |
| 7 | FEAT-007 | Multi-File Cross-Synthesis | Moonshot | 5 | 5 | 5 | 4 | 5 | 1.00 | `genie synth`, cross-file execution |

### Rationale for #1
`genie commit` (FEAT-001) offers the highest impact for the lowest effort. Developers write commits multiple times a day; automating this by reading `git diff --staged` is computationally cheap, highly deterministic, and immediately showcases the value of having an AI agent in the terminal workflow.

---

## Epics & Feature Details

### EPIC-01: Developer Workflow Automation
**Features:** FEAT-001, FEAT-005, FEAT-006

**FEAT-001: Auto-Generate Git Commit Messages (`genie commit`)**
- **Type:** `"feature"`
- **Area:** `"backend"`
- **Owner Role:** `"Fullstack"`
- **User Value Proposition:** Developers hate writing commit messages and often write poor ones. This command instantly generates semantic, context-aware commit messages based on actual code changes, saving time and improving repo history.
- **Scope:** Reads `git diff --staged` by default. Can optionally apply the commit via `git commit -m`. Does not handle resolving merge conflicts.
- **Implementation Steps:**
  1. Add `commit` to `cli/parse.ts` routing.
  2. Read output of `git diff --staged`. If empty, prompt user to stage files.
  3. Send diff to the provider with a system prompt optimized for Conventional Commits.
  4. Output the result to stdout or directly invoke `git commit` if a `--apply` flag is passed.
- **Acceptance Criteria:**
  - [ ] Running `genie commit` outputs a high-quality commit message based on staged files.
  - [ ] Gracefully handles empty staging areas with a clear error message.
  - [ ] Can handle large diffs by truncating safely or switching models.
- **Test Plan:** Unit test the prompt generation; manually test via CLI (user acceptance testing) by staging various changes and evaluating the output.
- **Targets/Search:** `git diff --staged`, `execFileSync('git'`

**FEAT-005: Task Planning from Prompt (`genie plan`)**
- **Type:** `"feature"`
- **Area:** `"backend"`
- **Owner Role:** `"BE"`
- **User Value Proposition:** Helps developers break down a large, vague feature request into a concrete, checkable markdown task list, combating "blank page syndrome" when starting a new task.
- **Scope:** Accepts a prompt. Outputs markdown. Optionally writes to `docs/todo.md`.
- **Implementation Steps:**
  1. Add `plan` to `cli.ts`.
  2. Accept prompt string as primary argument.
  3. Build a system prompt that enforces strict Markdown task list output (`- [ ]`).
  4. Output to terminal or save to a specified file via `--out` flag.
- **Acceptance Criteria:**
  - [ ] Outputs a structured, sequential markdown list of implementation steps.
  - [ ] Does not output unnecessary conversational filler (e.g., "Here is your plan:").
- **Test Plan:** Integration tests asserting the presence of markdown checkbox syntax in the output envelope.
- **Targets/Search:** `genie plan`, Markdown formatting.

**FEAT-006: Intelligent Test Generation (`genie test`)**
- **Type:** `"feature"`
- **Area:** `"backend"`
- **Owner Role:** `"Fullstack"`
- **User Value Proposition:** Reduces the tedium of writing boilerplate test setups. Automatically reads a target file, understands its exports, and generates a corresponding test file using the project's standard testing framework.
- **Scope:** Generates test code. Does not automatically run the tests or guarantee they pass on the first try.
- **Implementation Steps:**
  1. Add `test` command accepting a file path.
  2. Read the target file content.
  3. Determine the testing framework (e.g., by scanning `package.json`).
  4. Generate tests and optionally write to `<filename>.test.ts`.
- **Acceptance Criteria:**
  - [ ] Generates syntactically correct test code for the targeted file.
  - [ ] Includes edge case testing, not just happy-path.
- **Test Plan:** E2E testing: point `genie test` at a known pure function in the codebase and verify the output is valid TypeScript using `vitest`.
- **Targets/Search:** `genie test <file>`

### EPIC-02: Advanced Analytics & Ideation
**Features:** FEAT-002, FEAT-003, FEAT-004

**FEAT-002: Multi-Model Brainstorming (`genie brainstorm`)**
- **Type:** `"feature"`
- **Area:** `"backend"`
- **Owner Role:** `"Fullstack"`
- **User Value Proposition:** Different LLMs have different biases and strengths. When a user is stuck on an architectural decision or naming problem, this tool asks *all* available providers simultaneously and synthesizes their best ideas into a definitive list.
- **Scope:** Invokes multiple models in parallel. Requires at least 2 configured providers.
- **Implementation Steps:**
  1. Add `brainstorm` command.
  2. Map the prompt to all configured, authenticated providers via `Promise.all()`.
  3. Collect all responses.
  4. Feed all responses into the default/fastest provider (e.g., Gemini) with a synthesis prompt to extract the top distinct, non-overlapping ideas.
- **Acceptance Criteria:**
  - [ ] Command executes requests to multiple providers concurrently.
  - [ ] Final output is a clean synthesis, not just appended raw outputs.
- **Test Plan:** Unit test the synthesis pipeline using mocked provider responses. User acceptance testing to ensure the synthesized list is actually better than a single model's output.
- **Targets/Search:** `Promise.all`, provider mapping.
- **Experiment (Creative):** Timebox 2 hours to test if synthesizing multiple model outputs actually produces higher quality ideas than just asking Claude 3.5 Sonnet to "brainstorm 10 ideas".
- **Success Metric:** A panel review (manual) of the output prefers the synthesized list over the single-model list in at least 7/10 trials.
- **Rollback Plan:** If synthesis is too slow or too noisy, revert to a simple `--provider all` flag that just concatenates the outputs with headers.

**FEAT-003: Terminal Error Debugger (`genie debug`)**
- **Type:** `"feature"`
- **Area:** `"backend"`
- **Owner Role:** `"BE"`
- **User Value Proposition:** When a build fails or a script crashes, developers usually copy-paste the error into a web browser. `genie debug` allows them to pipe the error directly (e.g., `npm run build 2>&1 | genie debug`) to get an immediate explanation and fix.
- **Scope:** Reads from `stdin`. Analyzes stack traces and terminal output.
- **Implementation Steps:**
  1. Add `debug` command.
  2. Detect if `stdin` is not a TTY (i.e., data is being piped in).
  3. Capture piped string data.
  4. Prompt the AI: "Explain this error and provide a fix."
- **Acceptance Criteria:**
  - [ ] Can successfully read from standard input.
  - [ ] Identifies the root cause of standard stack traces (Node.js, Rust, etc.).
- **Test Plan:** E2E test by piping a known error string into the CLI and verifying the output mentions the core issue.
- **Targets/Search:** `process.stdin`, `isTTY`

**FEAT-004: Codebase "Roast" Mode (`genie roast`)**
- **Type:** `"feature"`
- **Area:** `"frontend"`
- **Owner Role:** `"Fullstack"`
- **User Value Proposition:** Adds a fun, viral feature to the CLI. Providing a humorous, Gordon Ramsay-style critique of code quality builds team culture and makes code review less dry.
- **Scope:** Wraps the standard `review` command logic but injects a highly specific, comedic system prompt.
- **Implementation Steps:**
  1. Add a `roast` alias or subcommand.
  2. Reuse the git diff extraction from the `review` command.
  3. Swap the standard review prompt for a sarcastic "roast" prompt.
- **Acceptance Criteria:**
  - [ ] The output is genuinely funny and critical but still accurately points out real code flaws.
  - [ ] Reuses 90% of the existing `review` command infrastructure.
- **Test Plan:** Manual execution on a piece of intentionally poorly written code.
- **Targets/Search:** `review` command extension, custom prompts.
- **Experiment (Creative):** Timebox 1 hour to tune the system prompt to ensure the AI doesn't refuse to roast due to "safety" guardrails (e.g., being "too mean").
- **Success Metric:** The AI consistently delivers a roast without tripping content filters.
- **Rollback Plan:** Remove the command if it proves too difficult to circumvent overly-sensitive model guardrails.

### EPIC-03: Autonomous Agency
**Features:** FEAT-007

**FEAT-007: Multi-File Cross-Synthesis (`genie synth`)**
- **Type:** `"feature"`
- **Area:** `"Fullstack"`
- **Owner Role:** `"Fullstack"`
- **User Value Proposition:** Moves `genie` from an "assistant" to an "agent". Instead of asking the AI to write one file, the user asks for a feature, and the AI edits/creates the DB schema, API route, and frontend component concurrently.
- **Scope:** Requires giving the CLI the ability to read the project directory structure, plan file edits, and write back to multiple files.
- **Implementation Steps:**
  1. Implement a tool-use loop (e.g., MCP or native function calling).
  2. Expose `read_file`, `write_file`, and `list_dir` capabilities to the model.
  3. Build the `synth` command that initializes this agentic loop.
  4. Stream the agent's thought process and actions to the terminal.
- **Acceptance Criteria:**
  - [ ] The command can successfully create >1 file based on a single prompt.
  - [ ] Prompts the user for confirmation before writing destructive changes to disk.
- **Test Plan:** E2E test in an isolated temporary directory, asking it to "create a standard express API with a health check route".
- **Targets/Search:** Agent loops, file system I/O, Tool Calling APIs.
- **Experiment (Moonshot):** Timebox 4 hours to build a primitive function-calling loop using Claude 3.5 Sonnet, restricting it to a sandbox directory to prevent accidental wipes.
- **Success Metric:** The CLI can successfully orchestrate the creation of 3 related files (e.g., HTML, CSS, JS) from a single prompt without crashing.
- **Rollback Plan:** If the loop is too unstable or context windows blow up, scrap the epic and focus on single-file generative commands.