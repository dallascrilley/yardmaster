# Feature Specification: Extract GitService from Review Command

**Feature Branch**: `001-extract-git-service`  
**Created**: 2026-03-05  
**Status**: Draft  
**Input**: User description: "2. REF-002: Extract GitService from review command (Priority: 2.00) * Target: genie/src/review/command.ts * Why: Git operations (safeGitRead, resolveGitContext, etc.) are currently hardcoded directly inside the review command module. Extracting these into a dedicated GitService separates I/O side effects from business logic, which massively improves testability and readability."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Review Command Functional Parity (Priority: P1)

As a developer using the CLI, I want the `review` command to continue functioning exactly as it did before, reliably extracting git context and diffs, so that I can seamlessly review code without disruptions.

**Why this priority**: The primary goal is a zero-regression refactoring. The review command is a core utility; its continued operational health is critical.

**Independent Test**: Can be fully tested by running `genie review` on a branch with uncommitted changes, staged changes, and against a base branch to ensure the generated diffs and git context match the expected output.

**Acceptance Scenarios**:

1. **Given** a dirty working tree, **When** the review command is executed, **Then** it correctly identifies the changes and runs the review using the newly abstracted Git service.
2. **Given** a specified `--base` flag, **When** the review command is executed, **Then** it correctly resolves the diff between the base and HEAD using the newly abstracted Git service.

---

### User Story 2 - Automated Testability (Priority: P2)

As a contributor to the codebase, I want the core business logic of the review command to be testable without requiring an active git repository, so that unit tests can be fast, reliable, and isolated.

**Why this priority**: Improving the testability of the project reduces long-term maintenance burden and enables more rigorous validation of the review logic.

**Independent Test**: Can be fully tested by verifying that unit tests for the review logic can mock the Git service interface and simulate various git states (e.g., detached head, missing branches, large diffs) without executing child processes.

**Acceptance Scenarios**:

1. **Given** the review command module, **When** writing a unit test, **Then** the Git service can be easily mocked to provide controlled responses.
2. **Given** a simulated error from the Git service, **When** the review command processes it, **Then** the command handles the failure gracefully according to established contracts.

### Edge Cases

- How does the system behave when executed in a directory that is not a git repository?
- What happens if the git child process encounters a system-level error (e.g., out of memory) rather than a standard git error?
- How are very large diffs managed by the extracted service compared to the in-line implementation?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST abstract all child_process git executions currently in `genie/src/review/command.ts` into a standalone, injectable GitService.
- **FR-002**: System MUST define a clear interface or contract for the GitService that outlines methods for fetching diffs, resolving branch context, and handling git read operations.
- **FR-003**: System MUST NOT change the underlying git commands executed or the logic used to parse their output; the extraction must be a pure structural refactoring.
- **FR-004**: System MUST allow the review command to accept an instance of the GitService (or a function matching its signature) to enable dependency injection for testing.

### Contract & Operational Requirements *(mandatory for runtime or CLI changes)*

- **CR-001**: No stdout contract change. Output must remain identical.
- **CR-002**: No machine contract change. JSON envelopes and exit codes must remain identical.
- **CR-003**: No provider execution change.
- **CR-004**: Execution must pass all existing integration tests (`cli.review-json.integration.test.ts`, `review.command.test.ts`) to prove behavioral parity.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero occurrences of `execFileSync('git', ...)` or direct `child_process` git invocations within the core `review/command.ts` file.
- **SC-002**: 100% of existing `review` command test cases continue to pass without changing the expected assertions.
- **SC-003**: Code coverage for the review command logic increases or remains stable, with new unit tests validating the isolated GitService.