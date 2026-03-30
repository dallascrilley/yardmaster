# E2E Smoke Test Suite Design

## Problem

Genie-cli has 37 unit and integration tests that exercise the full CLI pipeline using mock binaries, but no tests verify that the real provider CLIs (Claude, Codex, Gemini, Cursor Agent) actually work end-to-end. A breaking change in provider output format, auth flow, or argument handling would go undetected until a user hits it.

## Goal

Add a real-LLM smoke test layer that verifies basic round-trip functionality against real providers, with minimal cost and no disruption to the existing fast test suite.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Scope | Basic run + commit per provider | These two cover the core plumbing (arg building, spawning, output parsing). Other commands share the same spawn path. |
| Provider coverage | All four (Claude, Codex, Gemini, Cursor Agent) | Full coverage. Tests skip gracefully if a provider isn't available. |
| CI mandatory provider | Gemini only | Gemini authenticates via `GEMINI_API_KEY` env var — trivial to set as a CI secret. The other three use interactive CLI auth flows that are awkward in CI. |
| Mock E2E changes | None | Existing 20+ integration tests with mock binaries are sufficient. |
| CI trigger for smoke | `workflow_dispatch` + nightly cron | Mock tests on every push (existing). Real-LLM smoke on-demand or nightly. No per-commit LLM cost. |
| Test framework | Vitest (same as existing) | Consistent tooling, rich assertions, built-in skip/retry. |
| Cost per run | ~$0.01 | 8 calls total, <100 input tokens and <20 output tokens each. |

## Architecture

### File Layout

```
genie/
  test/
    smoke/
      smoke.run.test.ts          # Basic prompt round-trip per provider
      smoke.commit.test.ts       # Commit message generation per provider
      support/
        provider-check.ts        # Shared provider availability detection
  vitest.smoke.config.ts         # Smoke-only Vitest config
  package.json                   # Add "test:smoke" script

.github/
  workflows/
    smoke.yml                    # Nightly + manual trigger workflow
```

### Provider Detection (`provider-check.ts`)

Exports a single function:

```typescript
export async function checkProvider(
  providerId: string
): Promise<{ available: boolean; reason?: string }>
```

Implementation:
1. Spawns `genie providers doctor --json` once per test run (result cached in module scope).
2. Parses the JSON output to extract per-provider availability and auth status.
3. Returns `{ available: true }` if the provider binary is present and authenticated.
4. Returns `{ available: false, reason: "..." }` otherwise.

This exercises genie as a black box (the real linked binary), not imported TypeScript modules.

### Run Smoke Test (`smoke.run.test.ts`)

For each provider (`claude`, `codex`, `gemini`, `cursor-agent`):

1. Check provider availability via `checkProvider()`. Skip if unavailable.
2. Spawn: `genie run "Respond with exactly one word: hello" --provider <id>`
3. Assert: exit code 0, stdout contains "hello" (case-insensitive).

The prompt is designed for minimal tokens and deterministic-enough output.

### Commit Smoke Test (`smoke.commit.test.ts`)

For each provider:

1. Check provider availability. Skip if unavailable.
2. Create a temp git repo (reuse `createCliHarness()` workspace utilities).
3. Create and stage a one-line file change.
4. Spawn: `genie commit --provider <id>` from the workspace directory.
5. Assert: exit code 0, stdout is non-empty and at least 5 characters.

### Vitest Smoke Config (`vitest.smoke.config.ts`)

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/smoke/**/*.test.ts'],
    testTimeout: 60_000,    // 60s per test (real LLM calls can be slow)
    hookTimeout: 30_000,    // 30s for setup/teardown
    retry: 1,               // One automatic retry for transient failures
  },
})
```

### Package.json Script

```json
{
  "test:smoke": "vitest run --config vitest.smoke.config.ts"
}
```

### CI Workflow (`.github/workflows/smoke.yml`)

**Triggers:**
- `workflow_dispatch` — manual from GitHub Actions UI
- `schedule: cron: '0 6 * * *'` — nightly at 6am UTC

**Steps:**
1. Checkout repo
2. Setup Bun
3. `bun install`
4. `bun run build && bun link` (smoke tests run against the real linked binary)
5. `bun run test:smoke`

**Secrets:**
- `GEMINI_API_KEY` — required, set as environment variable

**Other providers:** Skip gracefully via provider detection. Can be added later by populating their auth config files from secrets.

**Failure handling:** Smoke failures show as a red badge on the Actions tab. They do not block merges (separate workflow from the main CI).

## Timeout & Retry

| Setting | Value | Rationale |
|---------|-------|-----------|
| Per-test timeout | 60s | Real LLM calls can take 10-30s |
| Suite timeout | 5 min | 8 tests with generous headroom |
| Retry | 1 | Covers transient rate limits / cold starts |

If a test fails twice, it's a real signal — either the provider is down or genie broke something.

## Cost Estimate

| Item | Count | Tokens | Cost |
|------|-------|--------|------|
| Run smoke (per provider) | 4 | ~100 in, ~20 out | ~$0.005 |
| Commit smoke (per provider) | 4 | ~200 in, ~50 out | ~$0.005 |
| **Total per run** | **8** | | **~$0.01** |
| **Monthly (nightly)** | **~240** | | **~$0.30** |

## What This Does NOT Cover

- Multi-provider fallback with real providers (tested thoroughly with mocks)
- Review command (same spawn path as run — covered by proxy)
- Design/debug commands (same spawn path)
- Auth failure and timeout error handling (pure mock territory)
- Interactive flows or TTY behavior

These are all covered by the existing mock-based integration tests.
