# Feature Specification: Multi-Model Brainstorming (`genie brainstorm`)

**Feature Branch**: `001-multi-model-brainstorming`  
**Created**: 2026-03-05  
**Status**: Draft  
**Input**: User description: "2. Multi-Model Brainstorming (genie brainstorm)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Prompting multiple models simultaneously (Priority: P1)

As a developer exploring technical solutions, I want to submit a single prompt to all configured AI providers simultaneously and receive a synthesized, deduplicated list of their best ideas, so I can benefit from diverse model strengths without manual copy-pasting.

**Why this priority**: This establishes the core value proposition: leveraging the unique perspectives of different LLMs concurrently. 

**Independent Test**: Can be tested by running `genie brainstorm "How should I structure my API?"` and verifying the CLI invokes multiple providers in parallel and returns a unified markdown response.

**Acceptance Scenarios**:

1. **Given** the user has multiple authenticated providers configured, **When** they run `genie brainstorm "<prompt>"`, **Then** the CLI sends the prompt to all providers concurrently.
2. **Given** the responses from multiple providers, **When** the synthesis phase completes, **Then** the CLI outputs a single, cohesive list of ideas without duplicate suggestions.

---

### User Story 2 - Handling provider failures gracefully (Priority: P2)

As a user executing a multi-model command, I want the system to gracefully handle timeouts or authentication errors from individual providers, so that one failing provider doesn't crash the entire brainstorming session.

**Why this priority**: Network requests are inherently flaky, and users may have partially configured or expired API keys for secondary providers.

**Independent Test**: Can be tested by intentionally breaking auth for one provider (e.g., Cursor) and verifying `genie brainstorm` still completes successfully using the remaining healthy providers.

**Acceptance Scenarios**:

1. **Given** three configured providers where one is unauthenticated, **When** the user runs a brainstorm, **Then** the CLI skips or ignores the failed provider and synthesizes results from the two successful ones.
2. **Given** the synthesis phase completes, **When** a provider failed, **Then** the CLI includes a minor diagnostic warning indicating which provider was excluded.

### Edge Cases

- What happens if the user only has one authenticated provider available? Does it gracefully degrade to a standard `run` request, or still attempt to "synthesize"?
- How does the system handle massive context prompts that exceed the token limit of some providers but not others?
- What if the synthesis step itself (which requires choosing a primary provider) fails?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST execute the user's prompt against all configured and authenticated AI providers in parallel (e.g., Claude, Codex, Gemini, Cursor).
- **FR-002**: System MUST aggregate the raw responses from all successful provider executions.
- **FR-003**: System MUST execute a secondary "synthesis" request using the default/primary provider to deduplicate and format the aggregated ideas into a single, cohesive response.
- **FR-004**: System MUST NOT fail the entire operation if a minority of providers fail (e.g., due to timeout or auth error); it must synthesize whatever successful responses it receives.
- **FR-005**: System MUST degrade gracefully to a standard single-model response if only one provider is available or successfully responds.

### Contract & Operational Requirements *(mandatory for runtime or CLI changes)*

- **CR-001**: A new subcommand `brainstorm` will be added to the CLI schema. Stdout will contain the final synthesized markdown string.
- **CR-002**: Exit code 0 for success. Exit code 1 if *all* providers fail or the final synthesis step fails.
- **CR-003**: Provider execution leverages parallel invocation instead of the standard sequential fallback chain used by `genie run`.
- **CR-004**: Integration tests must mock multiple providers returning different lists, asserting the final output is a synthesized aggregation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Brainstorming command executes across 3+ providers concurrently, taking no more time than the slowest individual provider plus the synthesis step (approx. < 15 seconds total).
- **SC-002**: A panel of diverse ideas is returned, with zero exact duplicates in the final synthesized output.
- **SC-003**: Command successfully completes 100% of the time as long as at least one provider is available and responsive.