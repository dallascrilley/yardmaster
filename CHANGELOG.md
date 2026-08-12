# Changelog

All notable changes to this package are documented here. This project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Entries at and below `0.2.0` describe the package under its former name, `genie`.

## [Unreleased]

### Changed

- **Renamed to `yardmaster`.** The binary is now `yardmaster`, environment variables are `YARDMASTER_*` (previously `GENIE_*`), project config moved from `.genie/config.json` to `.yardmaster/config.json`, and user config from `~/.config/genie/config.json` to `~/.config/yardmaster/config.json`. There is no compatibility shim; re-run `bun link` and rename any existing config directory.
- **Package moved to the repository root.** Sources live at `src/`, tests at `test/`, so `bun install && bun run test` works from a fresh clone with no subdirectory step.
- **Bun is the package manager of record.** `pnpm-lock.yaml` was removed; CI and the justfile already used Bun.
- **The scheduled smoke job runs codex through OpenRouter.** `.github/workflows/smoke.yml` now requires the `OPENROUTER_API_KEY` repository secret instead of `GEMINI_API_KEY`, installs `@openai/codex` and `@zed-industries/codex-acp`, and writes a `$CODEX_HOME/config.toml` selecting an OpenRouter `model_provider`. `test/smoke/global-setup.ts` derives its CI gate from `YARDMASTER_SMOKE_PROVIDERS` rather than hardcoding gemini. `bun run test:smoke:preflight` is now the codex-only filter; `bun run test:smoke:gemini` keeps the gemini-only one.

### Added

- **`yardmaster providers doctor --show-identity`** to opt back into unredacted provider auth output.

### Fixed

- **The CLI exits after printing its result.** `AcpClient.close()` killed the agent subprocess but left its stdio pipes referenced: `ndJsonStream` holds `child.stdout` behind a web-stream reader that is never cancelled, so the pipe never reached EOF and the event loop never drained. `run` and `commit` printed a correct envelope and then hung until an external timeout. `close()` now destroys all three pipes when the child exits, keeps the child handle referenced so the SIGKILL escalation can still land, and treats a signal-killed child (`exitCode === null`, `signalCode` set) as already exited.
- **`yardmaster providers doctor` (`codex`) recognizes an API-key `model_provider`.** A Codex pointed at a third-party OpenAI-compatible endpoint never logs in, so `codex login status` prints "Not logged in" and exits 1 even though the CLI works. When the login probes report no login, the check now reads `$CODEX_HOME/config.toml` (default `~/.codex/config.toml`): if the active `model_provider` declares an `env_key` and that variable is set, codex is reported authenticated. The details name the provider and the variable, never its value.
- **`yardmaster commit` sends the staged diff to the provider.** The command already read the diff to check that anything was staged, then threw it away and asked the agent to run `git diff --staged` itself. An agent that has to fetch the diff narrates the tool call ("I'll start by checking the staged changes…") into the same message stream as its answer, and it depends on the agent's shell tool being usable, which is not a given in a sandboxed CI runner. The diff is now inlined in the prompt (truncated past 24k characters, with the old instruction as the fallback), and the system prompt spells out that the entire reply is the subject line.
- **`yardmaster commit` reports what the provider actually returned.** A rejected message failed with nothing but "Provider returned a non-Conventional-Commit message", which made CI failures undiagnosable. The error now carries the raw response, flattened to one line and truncated to 200 characters.
- **`yardmaster commit` tolerates a fenced or announced message.** A markdown code fence anywhere in the reply is unwrapped, and up to three leading announcement lines (lines ending in a colon, such as `Here is the commit message:`) are skipped. An explanation, a refusal, or a list of alternatives is still rejected.
- **`yardmaster commit` tolerates an agent notice glued to the header.** codex-acp forwards Codex's "Model metadata for `<model>` not found" warning as an `agent_message_chunk` with no trailing newline, so the commit header arrived as `…cause issues.chore: add version.txt`. The header is now recovered from the tail of the first line, but only for a known Conventional Commits type. An explanatory preamble on its own line is still rejected.
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

- **`genie review`** still uses the legacy multi-agent spawn and parse path; migrating it to ACP is a known follow-up.
- **`genie providers`** (list, doctor) continues to use provider adapters for availability and auth reporting.

### Migration

- Install or expose ACP launchers as documented in `docs/TROUBLESHOOTING.md` and `genie providers doctor` (e.g. global `codex-acp` / `claude-agent-acp` or `npx` fallback).
- Ensure `GEMINI_API_KEY` (or provider-specific auth) is configured for Gemini-backed flows.
