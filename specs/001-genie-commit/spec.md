# Feature Specification: Auto-Generate Git Commit Messages (`genie commit`)

**Feature Branch**: `001-genie-commit`  
**Created**: 2026-03-05  
**Status**: Implemented (2026-03-06)  
**Input**: User description: "The top selected features are: 1. Auto-Generate Git Commit Messages (genie commit) 2. Multi-Model Brainstorming (genie brainstorm) (Creative) 3. Terminal Error Debugger (genie debug) 4. Codebase "Roast" Mode (genie roast) (Creative) 5. Task Planning from Prompt (genie plan) 6. Intelligent Test Generation (genie test) 7. Multi-File Cross-Synthesis (genie synth) (Moonshot)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generate commit message and review (Priority: P1)

As a developer, I want the CLI to read my staged changes and output a high-quality conventional commit message to standard output, so I can review it before creating the commit myself.

**Why this priority**: It establishes the core AI workflow (read diff -> generate message) in a non-destructive, safe manner.

**Independent Test**: Can be tested by staging changes, running `genie commit`, and verifying a semantically correct conventional commit message is printed to the terminal without modifying git state.

**Acceptance Scenarios**:

1. **Given** files are staged in the git index, **When** the user runs `genie commit`, **Then** the CLI queries the AI model with the diff and prints the resulting commit message to the terminal.
2. **Given** no files are staged, **When** the user runs `genie commit`, **Then** the CLI exits gracefully with an informative error message instructing the user to stage files first.

---

### User Story 2 - Generate and apply commit directly (Priority: P2)

As a fast-moving developer, I want the CLI to generate the commit message and automatically apply the commit to my staged changes in one command, saving me manual steps.

**Why this priority**: It provides the ultimate productivity boost for developers who trust the AI output for routine changes.

**Independent Test**: Can be tested by staging changes, running `genie commit --apply`, and verifying that `git status` shows a clean staging area and `git log` shows the newly created commit.

**Acceptance Scenarios**:

1. **Given** files are staged and the user runs `genie commit --apply`, **When** the AI returns a message, **Then** the CLI executes `git commit -m "<message>"` automatically.

### Edge Cases

- What happens if the staged diff is too large for the provider's context window?
- How does the system behave if the AI returns markdown formatting (e.g., surrounding the message with ```text) instead of raw text?
- How are git hooks (like `pre-commit` or `commit-msg`) handled when using `--apply`?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST read the output of `git diff --staged` when executing the commit command.
- **FR-002**: System MUST detect when the staging area is empty and return a clear error without querying the AI provider.
- **FR-003**: System MUST provide a system prompt that enforces the "Conventional Commits" specification (e.g., `feat:`, `fix:`, `chore:`).
- **FR-004**: System MUST clean or strip markdown code block wrappers from the AI response to ensure the raw commit message is valid.
- **FR-005**: System MUST support an `--apply` (or `-a`) flag that automatically executes `git commit -m` with the generated message.

### Contract & Operational Requirements *(mandatory for runtime or CLI changes)*

- **CR-001**: New subcommand `commit` will be added to the CLI schema. Stdout will contain the commit message or an error if no files are staged.
- **CR-002**: Exit code 0 for success. Exit code 1 if no files are staged or the provider fails.
- **CR-003**: No provider execution change. Leverages the standard fallback chain and timeout logic.
- **CR-004**: Add unit tests for the prompt generation and integration tests validating the `--apply` flag behavior against a mock git repository.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can generate a commit message from staged changes in under 3 seconds (assuming a fast provider like Gemini).
- **SC-002**: 95% of generated messages strictly adhere to the Conventional Commits format without human editing.
- **SC-003**: The command correctly aborts with exit code 1 when executed on an empty staging area.
