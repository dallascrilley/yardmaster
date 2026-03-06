# Feature Specification: Project Scaffolding Subcommand (`genie scaffold`)

**Feature Branch**: `001-genie-scaffold`  
**Created**: 2026-03-05  
**Status**: Draft  
**Input**: User description: "new subcommand: genie scaffold - scaffolds a new project based on a description or spec with file structure, README.md, basic hooks and docs, minimal code/comments to kick things off"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Scaffold a project from a natural language description (Priority: P1)

As a developer starting a new project, I want to provide a short description of what I am building to `genie scaffold`, and have it automatically generate the boilerplate file structure, README, and minimal starter code, so I can start writing business logic immediately without tedious setup.

**Why this priority**: Scaffolding new projects is a common, high-friction task. Providing an AI-driven kickstart delivers immediate, visible value and lowers the barrier to entry for starting new work.

**Independent Test**: Can be tested by running `genie scaffold "A basic Express REST API for a blog"` in an empty directory and verifying that a standard Node/Express folder structure with a `README.md`, `package.json` and basic entry point is generated.

**Acceptance Scenarios**:

1. **Given** an empty directory, **When** the user runs `genie scaffold "<description>"`, **Then** the CLI queries the AI model to generate a project structure and writes the corresponding files to the directory.
2. **Given** the scaffolding finishes successfully, **When** the user inspects the output, **Then** there is a complete foundational structure, including a descriptive README and minimal starter code/comments.

---

### User Story 2 - Scaffold from an existing specification document (Priority: P2)

As a technical lead who has already written a specification document, I want to pass that spec file into `genie scaffold` so the AI can generate a project structure that perfectly aligns with the documented architecture and requirements.

**Why this priority**: Integrates nicely with planning and specification workflows, moving seamlessly from documentation to concrete file generation.

**Independent Test**: Can be tested by running `genie scaffold --spec docs/my-app-spec.md` and verifying the generated boilerplate accurately reflects the technical decisions and module boundaries defined in the spec.

**Acceptance Scenarios**:

1. **Given** the user provides the `--spec <filepath>` flag, **When** the command is executed, **Then** the CLI reads the specification file and uses its contents to guide the scaffolding process.

### Edge Cases

- What happens if the current directory is not empty? Does it abort, warn the user, or merge files?
- How does the system handle scaffolding requests that exceed the AI provider's output token limits?
- What if the user asks for a project in a language or framework the AI model is less familiar with?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a `scaffold` subcommand that accepts either a natural language prompt or a `--spec <filepath>` flag.
- **FR-002**: System MUST generate a cohesive project structure including a `README.md`, necessary configuration files (e.g., `package.json`, `Cargo.toml`), and minimal starter code.
- **FR-003**: System MUST include basic documentation/comments within the generated code to guide the developer on where to add logic.
- **FR-004**: System MUST check if the target directory is empty before generating files. By default, if the directory contains files, the system MUST abort the scaffolding process and exit with an error. The system MUST provide an optional flag (e.g., `--merge`) to bypass this and merge non-destructively, where new files are added but existing files are not overwritten.
- **FR-005**: System MUST utilize a tool-calling loop or a structured output format (like an archive/JSON format) to write multiple files from a single AI inference pass.

### Contract & Operational Requirements *(mandatory for runtime or CLI changes)*

- **CR-001**: A new subcommand `scaffold` will be added to the CLI schema. Stdout will log the progress of file creation.
- **CR-002**: Exit code 0 for successful project generation. Exit code 1 for failure to write to the filesystem or provider error.
- **CR-003**: No underlying provider execution fallback chain change, though the execution itself may require multiple tool-calling cycles.
- **CR-004**: Add unit tests for verifying the scaffolding prompt structure and integration tests using a temporary directory to assert files are created correctly.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The system can successfully generate a standard web API or CLI project structure with >5 files within a single execution cycle.
- **SC-002**: 100% of generated projects include a customized `README.md` based on the user's initial prompt or specification.
- **SC-003**: Projects scaffolded into empty directories result in syntactically valid boilerplate without orphaned or hanging references.