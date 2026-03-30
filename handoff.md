# ACP Rewrite Handoff

## What was done

Replaced genie's CLI-spawn provider layer with ACP (Agent Client Protocol) for the `run` command. PR #31 on `feat/acp-rewrite`.

## Branch state

- **252 tests pass, 0 fail, TypeScript clean**
- `GENIE_USE_ACP=0` env var falls back to legacy CLI-spawn path
- All review blockers from code review addressed (6/6 findings fixed)

## New modules (all in `genie/src/acp/`)

| File | What it does |
|---|---|
| `types.ts` | `AcpProviderEntry`, `SessionHandle`, `StreamEvent` |
| `provider-registry.ts` | claude/codex/gemini -> ACP agent commands |
| `host-handlers.ts` | ACP `Client` impl: fs, terminal, permissions |
| `client.ts` | Spawn -> init -> session -> prompt -> close |
| `fallback.ts` | Try providers in ACP order |
| `run.ts` | `runViaAcp()` entry point |
| `../output/stream-renderer.ts` | Render streaming events to terminal |

## What changed in existing code

- `errors.ts` — added `AcpProtocolError` class
- `cli/dispatch/prompt-commands.ts` — `GENIE_USE_ACP` toggle routing `run` to ACP
- 4 test files — added `GENIE_USE_ACP=0` to env for legacy mock binary tests

## What still uses the legacy CLI-spawn path

`commit`, `debug`, `design`, `review` — unchanged, planned for Phases 2-4.

## Known issues

- **Ghost workflow**: Deleted "BuildFailed" workflow (ID 253562637) fires `startup_failure` on every PR event. Not fixable from repo — GitHub platform bug. Real CI (`ci.yml`) validates on push to `main`.
- **No real E2E test yet**: Tasks 11-12 (fake ACP server + real adapter tests) deferred. Local verification only.
- **`model` not passed through ACP**: Removed from `RunViaAcpInput` since the ACP SDK's `newSession`/`prompt` API doesn't have a standard model selection field. Needs investigation in Phase 2.
- **Sessions not implemented**: `-s` flag for persistent sessions is Phase 2.

## Next phases

| Phase | Scope |
|---|---|
| 2 | Sessions (`-s` flag) + model routing |
| 3 | Migrate `commit`, `debug`, `design` to ACP |
| 4 | Parallel ACP sessions for `review` |
| 5 | Delete legacy `providers/`, `execution/` code |

## Key docs

- Design spec: `docs/specs/2026-03-30-acp-rewrite-design.md`
- Phase 1 implementation plan: `docs/plans/2026-03-30-acp-rewrite-phase1.md`
- Phases 2-5 implementation plan: `docs/plans/2026-03-30-acp-rewrite-phases-2-5.md`
