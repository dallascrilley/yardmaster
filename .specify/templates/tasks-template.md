---

description: "Task list template for feature implementation"
---

# Tasks: [FEATURE NAME]

**Input**: Design documents from `/specs/[###-feature-name]/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are REQUIRED for any behavior, command-contract, provider,
configuration, or runtime change. Omit test tasks only for purely editorial
work.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Genie CLI default**: `genie/src/` for implementation and `genie/test/` for tests
- **Alternative layout**: use the paths documented in plan.md when a feature
  truly requires a different structure

<!-- 
  ============================================================================
  IMPORTANT: The tasks below are SAMPLE TASKS for illustration purposes only.
  
  The /speckit.tasks command MUST replace these with actual tasks based on:
  - User stories from spec.md (with their priorities P1, P2, P3...)
  - Feature requirements from plan.md
  - Entities from data-model.md
  - Endpoints from contracts/
  
  Tasks MUST be organized by user story so each story can be:
  - Implemented independently
  - Tested independently
  - Delivered as an MVP increment
  
  DO NOT keep these sample tasks in the generated tasks.md file.
  ============================================================================
-->

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create project structure per implementation plan
- [ ] T002 Initialize [language] project with [framework] dependencies
- [ ] T003 [P] Capture contract impact and required docs updates for changed commands
- [ ] T004 [P] Confirm verification commands and target test files for this feature

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

Examples of foundational tasks (adjust based on your project):

- [ ] T005 Setup shared runtime/config foundations needed by every story
- [ ] T006 [P] Establish output/error/JSON contract coverage for shared behavior
- [ ] T007 [P] Setup provider/auth/fallback infrastructure if multiple stories depend on it
- [ ] T008 Create base models/entities/helpers that all stories depend on
- [ ] T009 Configure error handling, logging, and timeout/cancellation infrastructure
- [ ] T010 Setup environment/configuration management

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - [Title] (Priority: P1) 🎯 MVP

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T011 [P] [US1] Contract test for [command/output] in genie/test/[name].test.ts
- [ ] T012 [P] [US1] Integration test for [user journey] in genie/test/[name].integration.test.ts

### Implementation for User Story 1

- [ ] T013 [P] [US1] Implement [helper/module] in genie/src/[area]/[file].ts
- [ ] T014 [P] [US1] Implement [supporting helper/module] in genie/src/[area]/[file].ts
- [ ] T015 [US1] Implement [command/feature] in genie/src/[area]/[file].ts (depends on T013, T014)
- [ ] T016 [US1] Add validation, error handling, and deterministic failure semantics
- [ ] T017 [US1] Update docs or schema text required by the command contract

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - [Title] (Priority: P2)

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests for User Story 2

- [ ] T018 [P] [US2] Contract test for [command/output] in genie/test/[name].test.ts
- [ ] T019 [P] [US2] Integration test for [user journey] in genie/test/[name].integration.test.ts

### Implementation for User Story 2

- [ ] T020 [P] [US2] Implement [helper/module] in genie/src/[area]/[file].ts
- [ ] T021 [US2] Implement [service/command path] in genie/src/[area]/[file].ts
- [ ] T022 [US2] Implement [endpoint/feature] in genie/src/[area]/[file].ts
- [ ] T023 [US2] Integrate with User Story 1 components (if needed)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - [Title] (Priority: P3)

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests for User Story 3

- [ ] T024 [P] [US3] Contract test for [command/output] in genie/test/[name].test.ts
- [ ] T025 [P] [US3] Integration test for [user journey] in genie/test/[name].integration.test.ts

### Implementation for User Story 3

- [ ] T026 [P] [US3] Implement [helper/module] in genie/src/[area]/[file].ts
- [ ] T027 [US3] Implement [service/command path] in genie/src/[area]/[file].ts
- [ ] T028 [US3] Implement [endpoint/feature] in genie/src/[area]/[file].ts

**Checkpoint**: All user stories should now be independently functional

---

[Add more user story phases as needed, following the same pattern]

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] TXXX [P] Documentation updates in docs/
- [ ] TXXX Code cleanup and refactoring
- [ ] TXXX Performance optimization across all stories
- [ ] TXXX [P] Additional contract/unit coverage in genie/test/
- [ ] TXXX Security hardening
- [ ] TXXX Run `cd genie && bun run typecheck && bun run test && bun run build`
- [ ] TXXX Validate any updated quickstart, README, or release-checklist guidance

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - May integrate with US1 but should be independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - May integrate with US1/US2 but should be independently testable

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Shared helpers before command wiring
- Command logic before integration polish
- Core implementation before doc and schema finalization
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- All tests for a user story marked [P] can run in parallel
- Models within a story marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Contract test for [command/output] in genie/test/[name].test.ts"
Task: "Integration test for [user journey] in genie/test/[name].integration.test.ts"

# Launch all implementation helpers for User Story 1 together:
Task: "Implement [helper/module] in genie/src/[area]/[file].ts"
Task: "Implement [supporting helper/module] in genie/src/[area]/[file].ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1
   - Developer B: User Story 2
   - Developer C: User Story 3
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Include contract, provider, and documentation tasks whenever CLI behavior changes
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
