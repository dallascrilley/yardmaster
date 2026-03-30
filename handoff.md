# ACP Rewrite Handoff

## What was done

Replaced genie's CLI-spawn provider layer with ACP (Agent Client Protocol) for `run`, `design`, `commit`, and `debug`. PR #31 on `feat/acp-rewrite`.

## Branch state

- Verify with `bun run test`, `bun run typecheck`, `bun run build`, `bun run test:critical-path` from `genie/`
- No `GENIE_USE_ACP` env toggle; rollback is revert or pin an older release

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
- `cli/dispatch/prompt-commands.ts` — prompt commands call `runViaAcp` / `runAcpCommand`

## What still uses the legacy path

`review` — existing review execution path (not migrated in this PR).

## Known issues

- **Ghost workflow (historical)**: Workflow id `253562637` (`BuildFailed`) is **`deleted`** in the GitHub API. Old PRs may still show past `startup_failure` runs; active workflows are **CI** (`ci.yml`) and **Smoke Tests** (`smoke.yml`).

## Key docs

- Design spec: `docs/specs/2026-03-30-acp-rewrite-design.md`
- Phase 1 implementation plan: `docs/plans/2026-03-30-acp-rewrite-phase1.md`
- Phases 2-5 implementation plan: `docs/plans/2026-03-30-acp-rewrite-phases-2-5.md`
