# Feature Specification: Task Planning from Prompt (`genie plan`)

**Feature Branch**: `001-genie-plan`  
**Created**: 2026-03-05  
**Status**: Draft  
**Input**: User description: "feat: New Subcommands 5. Task Planning from Prompt (genie plan)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generate a markdown task list from a prompt (Priority: P1)

As a developer starting a new feature, I want to provide a brief natural language description to the CLI and receive a structured, step-by-step markdown task list, so that I can easily break down the work and track my progress.

**Why this priority**: Breaking down work is a critical first step in development. Automating the creation of a checklist directly addresses "blank page syndrome" and accelerates project kickoff.

**Independent Test**: Can be tested by running `genie plan "Implement user authentication"` and verifying the CLI outputs a valid markdown list with checkboxes (`- [ ]`) detailing the logical implementation steps.

**Acceptance Scenarios**:

1. **Given** a clear natural language prompt, **When** the user runs `genie plan "<prompt>"`, **Then** the CLI queries the AI model and outputs a structured markdown checklist.
2. **Given** a generated checklist, **When** the user inspects the output, **Then** it contains actionable, discrete development tasks formatted with standard markdown checkboxes.

---

### User Story 2 - Save the generated plan to a file (Priority: P2)

As a developer planning a significant feature, I want the CLI to automatically save the generated task list to a designated file (e.g., `docs/todo.md`), so that I don't have to manually copy and paste the terminal output into my project's documentation.

**Why this priority**: Writing the plan to disk directly integrates the AI's output into the user's persistent workflow and project state.

**Independent Test**: Can be tested by running `genie plan "Create a settings page" --out docs/plan.md` and verifying that the specified file is created or updated with the generated markdown checklist.

**Acceptance Scenarios**:

1. **Given** the user provides an `--out` flag with a file path, **When** the plan is generated, **Then** the CLI writes the markdown checklist directly to the specified file.
2. **Given** the `--out` flag is used, **When** the command completes successfully, **Then** the CLI outputs a brief success message to the terminal indicating where the file was saved.

### Edge Cases

- What happens if the prompt is too vague or short (e.g., `genie plan "fix bug"`)?
- How should the CLI handle the `--out` flag if the target file already exists? (Overwrite, append, or abort?)
- What if the AI model refuses to generate a plan or includes unwanted conversational filler (e.g., "Here is the plan you requested:")?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept a natural language prompt as the primary argument for the `plan` subcommand.
- **FR-002**: System MUST generate a system prompt instructing the AI provider to output a strict markdown task list (using `- [ ]` syntax).
- **FR-003**: System MUST strip out any conversational filler or conversational preambles from the AI's response to ensure clean markdown output.
- **FR-004**: System MUST support an optional `--out <filepath>` flag.
- **FR-005**: If the `--out` flag is provided, the system MUST write the generated markdown to the specified file path. If a file already exists at that path, the system MUST create a new file by appending a timestamp to the original filename (e.g., `plan_1678886400.md`) to prevent data loss.

### Contract & Operational Requirements *(mandatory for runtime or CLI changes)*

- **CR-001**: A new subcommand `plan` will be added to the CLI schema. Stdout will contain the generated markdown unless `--out` is specified.
- **CR-002**: Exit code 0 for success. Exit code 1 if the provider fails or file writing fails.
- **CR-003**: No provider execution change. Leverages the standard fallback chain and timeout logic.
- **CR-004**: Add unit tests for prompt formatting and integration tests for the `--out` flag behavior using a temporary file system.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can generate a structured task list from a prompt in under 5 seconds.
- **SC-002**: 95% of generated plans contain valid markdown checkbox syntax (`- [ ]`) without human editing.
- **SC-003**: 100% of plans generated with the `--out` flag are successfully written to the correct destination path.