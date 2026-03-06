# Feature Specification: Replace manual timeouts with AbortController

**Feature Branch**: `001-abort-controller-timeouts`  
**Created**: 2026-03-05  
**Status**: Draft  
**Input**: User description: "1. REF-001: Replace manual timeouts with AbortController (Priority: 2.00) * Target: genie/src/providers/base.ts * Why: The current process execution (runCommand) manually establishes timeouts using setTimeout and issues nested kill('SIGTERM') / kill('SIGKILL') calls. This is complex and leak-prone. Replacing this with native Node.js AbortController and signals offers an immediate reduction in error-prone"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Provider Execution Timeout (Priority: P1)

When a command takes longer than the allowed execution timeout limit, the system must cleanly abort the underlying process using native operating system signals.

**Why this priority**: Correctly terminating runaway execution commands prevents system resource exhaustion and ensures predictable response times for the CLI tool.

**Independent Test**: Can be tested by running a command that takes longer than the configured timeout and observing that it exits cleanly with the expected timeout error without leaving lingering background processes.

**Acceptance Scenarios**:

1. **Given** a command execution configured with a specific timeout limit, **When** the execution time exceeds the limit, **Then** the process is terminated via native abort mechanisms and the CLI returns a timeout error.
2. **Given** an aborted execution, **When** the system cleans up, **Then** all standard input/output streams are closed and no zombie processes remain.

---

### User Story 2 - Provider Execution Completion (Priority: P2)

When a command completes successfully within the timeout limit, the system should safely clean up its resources without memory leaks or throwing unexpected errors.

**Why this priority**: Normal operations must not be adversely affected by the timeout mechanism.

**Independent Test**: Can be tested by successfully completing normal interactions and validating that memory and timeout limits are cleared.

**Acceptance Scenarios**:

1. **Given** a standard command execution that completes within the limit, **When** the execution finishes successfully, **Then** the result is returned normally and no exceptions are thrown.

### Edge Cases

- What happens if the process throws an error unrelated to the timeout just as the abort signal is sent?
- How does the system handle processes that are already dead when the abort signal triggers?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST use native process termination signals to manage execution timeouts instead of application-level timers.
- **FR-002**: System MUST completely eliminate the usage of manual timer-based process killing chains for managing execution timeouts.
- **FR-003**: System MUST intercept native abort signals and normalize them into the existing standard timeout error responses.

### Contract & Operational Requirements *(mandatory for runtime or CLI changes)*

- **CR-001**: No stdout contract change.
- **CR-002**: No machine contract change.
- **CR-003**: No provider execution change from the consumer's perspective (timeout behaviors remain functionally identical to callers).
- **CR-004**: Execution must pass all existing test suites to prove behavior parity.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero occurrences of manual application-level timers used for process killing.
- **SC-002**: 100% of existing timeout-related test cases continue to pass without changes to the tests.
- **SC-003**: No background processes or resource leaks remain after an execution times out.