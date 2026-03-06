# Feature Specification: Terminal Error Debugger (`genie debug`)

**Feature Branch**: `001-genie-debug`  
**Created**: 2026-03-05  
**Status**: Implemented (2026-03-06)  
**Input**: User description: "feat: New Subcommands - Terminal Error Debugger (genie debug)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Diagnose a piped terminal failure (Priority: P1)

As a developer, I want to pipe a build error, stack trace, or failed command output into `genie debug` and immediately receive an explanation of the likely root cause and a suggested fix.

**Why this priority**: This is the core user value of the feature and covers the primary pain point of leaving the terminal to manually search for an explanation.

**Independent Test**: Can be tested by piping a known terminal error into `genie debug` and verifying that the command returns a diagnosis and at least one concrete remediation step without requiring any interactive prompts.

**Acceptance Scenarios**:

1. **Given** a developer pipes a recognizable stack trace into `genie debug`, **When** the command runs successfully, **Then** it outputs a plain-language explanation of the likely root cause and a suggested next step.
2. **Given** a developer pipes terminal output that includes both the failing command and the error details, **When** the command runs, **Then** the response identifies the most relevant failure instead of echoing the entire input back verbatim.

---

### User Story 2 - Fail fast when no error content is provided (Priority: P2)

As a developer, I want `genie debug` to clearly tell me when I have not provided terminal output, so I do not waste time waiting for a meaningless response.

**Why this priority**: Clear failure behavior protects trust in the command and prevents accidental empty or interactive invocations from appearing broken.

**Independent Test**: Can be tested by running `genie debug` without piped input and verifying that it exits with a clear usage error instead of hanging or returning an invented diagnosis.

**Acceptance Scenarios**:

1. **Given** a developer runs `genie debug` without piped input, **When** the command determines no terminal content was supplied, **Then** it exits promptly with guidance explaining how to provide error output.
2. **Given** a developer pipes only blank lines or whitespace into `genie debug`, **When** the command validates the input, **Then** it treats the request as empty and returns the same guidance as a missing-input invocation.

---

### User Story 3 - Use debug output in scripted workflows (Priority: P3)

As a developer automating local troubleshooting, I want `genie debug` to behave predictably in shell pipelines so I can include it in repeatable debugging workflows.

**Why this priority**: Stable terminal behavior makes the feature useful beyond manual experimentation and ensures it fits the existing CLI contract expectations.

**Independent Test**: Can be tested by piping a known error string into `genie debug` from a script or passing a saved log file and verifying that success and failure cases return consistent exit codes and write the analysis to standard output.

**Acceptance Scenarios**:

1. **Given** a script pipes a known error into `genie debug`, **When** the command succeeds, **Then** the analysis is written to standard output and the process exits with code 0.
2. **Given** a script invokes `genie debug` with no usable input, **When** the command fails validation, **Then** the guidance is written to standard error and the process exits with a non-zero code.
3. **Given** a script passes a saved terminal log with `genie debug --input-file <path>`, **When** the command succeeds, **Then** it returns the same diagnosis contract as piped input without requiring stdin.
4. **Given** a script invokes `genie debug --json`, **When** the command succeeds or fails, **Then** it emits the shared CLI JSON envelope on standard output with the appropriate exit code metadata.

### Edge Cases

- How does the system respond when the piped terminal output contains multiple unrelated errors in the same payload?
- How does the system respond when the input is extremely long and includes large volumes of non-error noise before the actual failure?
- What happens when the error text is truncated and does not include the full stack trace or command context?
- What happens when the provider cannot return a diagnosis because authentication, timeout, or service availability blocks execution?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a new `genie debug` subcommand dedicated to analyzing terminal error output.
- **FR-002**: System MUST accept terminal error content supplied through piped input or an explicit input file path.
- **FR-003**: System MUST reject invocations where no usable terminal error content is supplied.
- **FR-004**: System MUST generate a response that includes both a likely root-cause explanation and at least one actionable remediation step.
- **FR-005**: System MUST prioritize the most relevant failure in the supplied input when multiple lines of terminal output are present.
- **FR-006**: System MUST preserve non-interactive behavior so the command can be used safely inside shell pipelines and scripts.
- **FR-007**: System MUST return an explicit failure result when a diagnosis cannot be produced because the underlying AI execution fails.
- **FR-008**: System MUST avoid claiming certainty when the supplied terminal output is incomplete or ambiguous.

### Contract & Operational Requirements *(mandatory for runtime or CLI changes)*

- **CR-001**: Stdout behavior changes by adding a new `genie debug` command that emits human-readable diagnostic output on success.
- **CR-002**: `genie debug` MUST preserve predictable CLI contracts for both plain-text and machine-readable usage: success returns exit code 0; validation and execution failures return non-zero exit codes; `--json` emits the shared CLI JSON envelope on standard output.
- **CR-003**: No provider execution change. The feature uses the existing provider authentication, fallback, and timeout behavior already defined for the CLI.
- **CR-004**: Automated verification MUST include parser coverage for the new subcommand, execution tests for piped-input success and empty-input failure, coverage for `--input-file`, coverage for `--json` success/failure behavior, and the repository test command `cd genie && bun test`.

### Assumptions

- The initial release supports both pipeline-friendly stdin usage and explicit log-file input for saved terminal output.
- The command is intended for local developer troubleshooting and does not need collaboration, sharing, or persistence features in this scope.
- The first release keeps plain-language diagnostic output as the default while also supporting the shared CLI `--json` envelope for scripted consumers.

### Key Entities *(include if feature involves data)*

- **Debug Input**: A block of terminal output supplied by the user, such as a stack trace, compiler failure, or command stderr stream.
- **Diagnostic Result**: The generated explanation that summarizes the likely root cause, confidence caveats, and recommended next actions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing with representative terminal failures, 90% of successful `genie debug` runs identify the primary issue category well enough for a reviewer to select the correct remediation path on first read.
- **SC-002**: 95% of invocations without usable piped input fail in under 2 seconds with clear guidance on how to provide error content.
- **SC-003**: 100% of scripted success-path tests confirm that diagnostic text or the shared JSON success envelope is written to standard output and the process exits with code 0.
- **SC-004**: 100% of scripted validation-failure tests confirm that plain-mode guidance is written to standard error or JSON-mode failures are emitted as the shared error envelope on standard output, with a non-zero exit code.
