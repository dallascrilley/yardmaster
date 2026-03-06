# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript 5.x on Bun (note any exception explicitly)  
**Primary Dependencies**: Bun CLI tooling, `zod`, provider CLIs under integration, or NEEDS CLARIFICATION  
**Storage**: User config in `~/.config/genie/config.json`, optional project config in `.genie/config.json`, or N/A  
**Testing**: `vitest` unit/integration coverage plus command-contract verification  
**Target Platform**: macOS/Linux shell environments that can execute provider CLIs
**Project Type**: Multi-provider CLI  
**Performance Goals**: Fast command startup, deterministic completion, no hanging subprocesses  
**Constraints**: Stable stdout/stderr separation, stable JSON when exposed, documented exit codes, no indefinite hangs  
**Scale/Scope**: Local-first CLI used by humans, scripts, and agents across multiple providers

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Command-contract impact is explicit: state whether stdout, stderr, help text,
  JSON envelopes, review schema, or exit codes change.
- Provider impact is isolated: provider-specific behavior remains in adapter,
  doctor, or preset layers unless the plan justifies a broader surface change.
- Test coverage is explicit: list required `genie/test/` updates for parser,
  contract, integration, or provider behavior changes.
- Verification commands are planned: `cd genie && bun run typecheck && bun run
  test && bun run build`.
- Added complexity is justified in `Complexity Tracking` when the work introduces
  new abstractions, command trees, or orchestration state.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below only if the feature
  genuinely requires a new layout. Most work in this repo should fit the
  existing `genie/` package structure.
-->

```text
genie/
├── src/
│   ├── bin/
│   ├── cli/
│   ├── config/
│   ├── execution/
│   ├── presets/
│   ├── providers/
│   ├── review/
│   ├── runtime/
│   └── update/
├── test/
└── dist/

docs/
.specify/
```

**Structure Decision**: Use the existing `genie/` package structure unless the
plan documents a concrete reason to expand beyond it.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
