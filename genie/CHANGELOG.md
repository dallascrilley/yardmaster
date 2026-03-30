# Changelog

All notable changes to the `genie` package are documented here. This project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Nothing yet.

## [0.2.0] - 2026-03-30

### Changed

- **Prompt commands** (`run`, `design`, `commit`, `debug`) now execute through the **Agent Client Protocol (ACP)** by default: genie spawns ACP agent processes (e.g. Zed codex/claude adapters or `gemini`), negotiates capabilities, and streams structured responses. The previous primary path that spawned raw provider CLIs with ad hoc stdout parsing for these commands has been removed.
- **No environment toggle** for switching back to the old prompt stack: rollback is **pin `genie` to v0.1.x** or **revert** the ACP migration commits.

### Unchanged / follow-up

- **`genie review`** still uses the legacy multi-agent spawn and parse path; migrating it to ACP is tracked in `docs/specs/2026-03-30-acp-rewrite-design.md` (implementation status section).
- **`genie providers`** (list, doctor) continues to use provider adapters for availability and auth reporting.

### Migration

- Install or expose ACP launchers as documented in `docs/TROUBLESHOOTING.md` and `genie providers doctor` (e.g. global `codex-acp` / `claude-agent-acp` or `npx` fallback).
- Ensure `GEMINI_API_KEY` (or provider-specific auth) is configured for Gemini-backed flows.
