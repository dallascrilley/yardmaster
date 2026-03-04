# Genie CLI Design (v1)

**Date:** 2026-03-04
**Status:** Approved
**Author:** Dallas + Codex

## Overview
`genie` is a Bun-first TypeScript CLI that provides a single, low-friction command surface for headless LLM calls across `claude`, `codex`, `cursor-agent`, and `gemini`. It absorbs provider-specific flags and defaults so users can run requests as `genie <prompt...>` (or optional aliases like `genie wish <prompt...>` and `genie rub <prompt...>`). v1 prioritizes speed of daily use and predictable cross-provider behavior, while avoiding overbuilt session/orchestration features.

## Goals
- Minimize typing and cognitive overhead for repeated LLM CLI usage.
- Normalize common behavior across multiple provider CLIs.
- Automatically handle provider fallback, auth checks, workspace resolution, and output mode.
- Persist last-used settings globally for continuity.

## Non-Goals (v1)
- Long-lived conversational session engine.
- Multi-step workflow orchestration/replay.
- Per-project config layering.
- Plugin SDK.

## Architecture
### Selected v1 Pattern: Direct Adapter Commands
`genie` uses one command execution pipeline with explicit provider adapters:
1. Parse user intent (`genie <prompt...>` plus optional flags)
2. Load global config and last-used preferences
3. Resolve workspace path
4. Pick provider (preferred -> fallback chain)
5. Build provider-specific invocation
6. Execute subprocess and normalize output
7. Persist updated defaults

This keeps implementation small while still isolating provider quirks.

## Framework and Runtime Choices
- Framework: `dc-cli-kit` as primary API surface.
- Underlying behavior: incur command/output semantics.
- Runtime: Bun-first.
- Language: TypeScript.

## Command Surface
- Primary: `genie <prompt...>`
- Optional aliases: `genie wish <prompt...>`, `genie rub <prompt...>`
- v1 aliases are semantic sugar; they route into the same executor.
- Avoid subcommand-heavy UX in v1.

## Config and State
Global config path:
- `~/.config/genie/config.json`

Stored state (initial schema):
- `provider.default`
- `provider.fallbackOrder[]`
- `model.byProvider`
- `mode.default`
- `workspace.last`
- `output.default` (auto/pretty/json)
- `trust.default`

State policy:
- Last-used wins unless explicit user override is passed.
- Writes occur after successful command execution.

## Authentication Strategy
- Reuse each provider's native CLI auth/session.
- Adapter preflight checks:
  - Binary available
  - Authenticated status valid
- If preferred provider fails preflight, auto-fallback to next configured provider.
- If all providers fail, return actionable error with fix commands.

## Output Strategy
TTY-aware default:
- TTY stdout: human-readable output.
- Non-TTY (pipe/redirect/agent): structured JSON envelope.

Override flags:
- `--json` forces JSON.
- `--format <toon|json|yaml|md>` available via incur/dc-cli-kit conventions.

## Provider Adapter Contract
Each adapter implements:
- `name`: provider id
- `isAvailable(): Promise<boolean>`
- `isAuthenticated(): Promise<boolean>`
- `buildInvocation(req): { cmd: string, args: string[] }`
- `execute(invocation): Promise<{ stdout: string, stderr: string, code: number }>`
- `parse(result): NormalizedProviderResult`

Normalized request shape (internal):
- `prompt: string`
- `workspace: string`
- `mode: string`
- `model?: string`
- `trust: boolean`
- `output: 'auto' | 'pretty' | 'json'`

## Error Model
Use `dc-cli-kit` standardized errors and exit codes:
- Auth/preflight issues -> auth/config-style errors with remediation hints.
- Provider execution failure -> structured error with provider name and command summary.
- Total fallback exhaustion -> single consolidated failure with per-provider reason list.

## Security and Safety
- Never print secrets/tokens.
- Sanitize command logs and URL-like outputs.
- Trust mode defaults can be set globally but are overridable per command.

## Testing Strategy
Core tests (v1):
- Unit tests: config load/save, fallback selection, request normalization, output mode selection.
- Adapter tests: invocation argument formation per provider.
- Integration tests: mocked subprocess responses for success/fallback/failure paths.
- Smoke tests: TTY vs non-TTY output behavior.

## Incremental Delivery Plan
1. Bootstrap CLI shell with `dc-cli-kit` and base config schema.
2. Implement provider registry + fallback selector.
3. Add adapters for claude/codex/cursor-agent/gemini (minimal viable flags).
4. Add output normalization and TTY policy.
5. Add state persistence (last-used defaults).
6. Add tests for fallback + output + config behavior.

## Chosen Options Summary
- Success priority: fastest daily workflow + cross-provider reliability.
- Missing provider behavior: auto-fallback.
- Output default: TTY auto-detect.
- State location: global config only.
- Auth: reuse provider-native auth.
- Command surface: single command with optional playful aliases.
- Runtime: Bun-first.
- v1 architecture: direct adapter commands.

## Next Steps
- Create implementation plan at `docs/plans/2026-03-04-genie-cli-implementation.md`.
- Optionally set up isolated worktree before coding.
