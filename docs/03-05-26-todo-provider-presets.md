# Provider Presets + Provider Flag Mapping Todo (03-05-26)

- [x] Add preset-aware request/config types for:
  - [x] yolo
  - [x] includeDirectories
  - [x] trust
  - [x] outputFormat
  - [x] headless/print
  - [x] mode
  - [x] model
  - [x] extensions
  - [x] mcp
- [x] Add `presets` command tree (`list`, `get`, `set`, `delete`)
- [x] Add `--preset <name>` support to `genie run`
- [x] Implement provider-specific flag/syntax mapping for claude/codex/cursor-agent/gemini
- [x] Fix codex non-interactive invocation path
- [x] Add/extend parser and adapter tests for preset behavior and provider mappings
- [x] Update README usage/docs for presets and mapped behavior
- [x] Run verification (`qa` if available, otherwise typecheck + test + build)
- [x] Log progress and handoff in TD
