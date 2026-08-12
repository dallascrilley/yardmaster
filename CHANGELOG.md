# Changelog

All notable changes to this package are documented here. This project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Entries at and below `0.2.0` describe the package under its former name, `genie`.

## [Unreleased]

### Changed

- **Renamed to `yardmaster`.** The binary is now `yardmaster`, environment variables are `YARDMASTER_*` (previously `GENIE_*`), project config moved from `.genie/config.json` to `.yardmaster/config.json`, and user config from `~/.config/genie/config.json` to `~/.config/yardmaster/config.json`. There is no compatibility shim; re-run `bun link` and rename any existing config directory.
- **Package moved to the repository root.** Sources live at `src/`, tests at `test/`, so `bun install && bun run test` works from a fresh clone with no subdirectory step.
- **Bun is the package manager of record.** `pnpm-lock.yaml` was removed; CI and the justfile already used Bun.

### Added

- **`yardmaster providers doctor --show-identity`** to opt back into unredacted provider auth output.

### Fixed

- **`yardmaster providers doctor` no longer leaks operator identity.** `claude auth status` returns JSON carrying `email`, `orgId`, and `orgName`, and the doctor passed it through verbatim. Detail fields are now redacted by default and the report carries `identityRedacted`.
- **`yardmaster providers doctor` (`codex`)**: `codex auth status` was removed in codex-cli 0.147.0, which answers it with `error: unrecognized subcommand 'status'` and exit 2, so an authenticated Codex was reported as an auth failure. The probe now tries `codex login status` first, falls back to `codex auth status`, then to `~/.codex/auth.json`, and finally reports an explicit unsupported-version result.

- **ACP Gemini**: spawn `gemini --acp` so JSON-RPC mode matches the documented Gemini CLI ACP contract (fixes hangs / broken review when the interactive CLI was invoked without `--acp`).
- **ACP Cursor**: register `cursor-agent` as **`agent acp`** with post-`initialize` **`authenticate` (`cursor_login`)**; optional **`GENIE_CURSOR_ACP_BIN`** when `agent` is not on `PATH`.
- **ACP errors**: normalize `@agentclientprotocol/sdk` JSON-RPC rejections (plain `{ code, message, data }` objects) so `genie review` and fallback diagnostics show real messages instead of `[object Object]`.
- **`genie providers doctor` (`cursor-agent`)**: probe **`agent --version`** and **`agent status`** (same binary as **`agent acp`** / **`GENIE_CURSOR_ACP_BIN`**) instead of the obsolete `cursor-agent auth status` pair.

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
