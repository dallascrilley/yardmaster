# E2E Smoke Test Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real-LLM smoke test suite that verifies basic round-trip functionality against real provider CLIs, with skip-if-unavailable logic and a separate CI workflow.

**Architecture:** A new `test/smoke/` directory with Vitest tests that spawn the real `genie` binary against real providers. A shared helper detects provider availability via `genie providers doctor --json`. A separate `vitest.smoke.config.ts` provides longer timeouts and retry. A new GitHub Actions workflow runs the suite on manual trigger and nightly cron.

**Tech Stack:** TypeScript, Vitest, Bun, GitHub Actions

**Spec:** `docs/superpowers/specs/2026-03-29-e2e-smoke-tests-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `genie/test/smoke/support/provider-check.ts` | Spawns `genie providers doctor --json`, caches result, exports per-provider availability check |
| Create | `genie/test/smoke/smoke.run.test.ts` | For each provider: skip if unavailable, run a minimal prompt, assert "hello" in output |
| Create | `genie/test/smoke/smoke.commit.test.ts` | For each provider: skip if unavailable, create temp git repo, stage a file, run `genie commit`, assert non-empty output |
| Create | `genie/vitest.smoke.config.ts` | Vitest config including only `test/smoke/**/*.test.ts` with 60s timeout and 1 retry |
| Modify | `genie/package.json` | Add `"test:smoke"` script |
| Create | `.github/workflows/smoke.yml` | `workflow_dispatch` + nightly cron workflow that builds, links, and runs smoke tests |

---

### Task 1: Provider Check Helper

**Files:**
- Create: `genie/test/smoke/support/provider-check.ts`

- [ ] **Step 1: Create the provider-check helper**

Create `genie/test/smoke/support/provider-check.ts`:

```typescript
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const projectRoot = fileURLToPath(new URL('../../..', import.meta.url))
const bunBinary = execFileSync('which', ['bun'], { encoding: 'utf8' }).trim() || 'bun'
const sourceCliPath = join(projectRoot, 'src', 'bin', 'genie.ts')

export type ProviderStatus = { available: boolean; reason?: string }

type DoctorEnvelope = {
  ok: boolean
  providers: Array<{
    provider: string
    available: boolean
    authenticated: boolean
    availabilityDetails?: string
    authDetails?: string
  }>
}

let cachedStatuses: Map<string, ProviderStatus> | undefined

function loadStatuses(): Map<string, ProviderStatus> {
  if (cachedStatuses) return cachedStatuses

  cachedStatuses = new Map()

  const result = execFileSync(bunBinary, [sourceCliPath, 'providers', 'doctor', '--json'], {
    encoding: 'utf8',
    timeout: 30_000,
    env: { ...process.env },
  })

  let envelope: DoctorEnvelope
  try {
    envelope = JSON.parse(result)
  } catch {
    // If JSON parsing fails, mark all providers as unavailable
    return cachedStatuses
  }

  for (const entry of envelope.providers) {
    if (entry.available && entry.authenticated) {
      cachedStatuses.set(entry.provider, { available: true })
    } else {
      const reasons: string[] = []
      if (!entry.available) reasons.push(entry.availabilityDetails ?? 'binary not found')
      if (!entry.authenticated) reasons.push(entry.authDetails ?? 'not authenticated')
      cachedStatuses.set(entry.provider, { available: false, reason: reasons.join('; ') })
    }
  }

  return cachedStatuses
}

export function checkProvider(providerId: string): ProviderStatus {
  const statuses = loadStatuses()
  return statuses.get(providerId) ?? { available: false, reason: 'not in doctor output' }
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd /Users/dallascrilley/Code/genie-cli/genie && bunx tsc --noEmit test/smoke/support/provider-check.ts --moduleResolution bundler --module nodenext --target esnext --skipLibCheck`

If there are type errors, fix them. A clean compilation is sufficient — this helper will be exercised by the test files in Tasks 2 and 3.

- [ ] **Step 3: Commit**

```bash
git add genie/test/smoke/support/provider-check.ts
git commit -m "test(smoke): add provider availability detection helper"
```

---

### Task 2: Vitest Smoke Config + Package Script

**Files:**
- Create: `genie/vitest.smoke.config.ts`
- Modify: `genie/package.json`

- [ ] **Step 1: Create the smoke Vitest config**

Create `genie/vitest.smoke.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/smoke/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 30_000,
    retry: 1,
  },
})
```

- [ ] **Step 2: Add the test:smoke script to package.json**

In `genie/package.json`, add to the `"scripts"` object:

```json
"test:smoke": "vitest run --config vitest.smoke.config.ts"
```

The full scripts block becomes:

```json
"scripts": {
  "build": "tsc -p tsconfig.json",
  "test": "vitest run",
  "test:critical-path": "vitest run test/cli.critical-path.integration.test.ts test/cli.linked-binary.integration.test.ts",
  "test:smoke": "vitest run --config vitest.smoke.config.ts",
  "typecheck": "tsc -p tsconfig.json --noEmit",
  "doctor:flake": "bun run scripts/quantify-doctor-flake.ts"
}
```

- [ ] **Step 3: Verify existing tests still pass**

Run: `cd /Users/dallascrilley/Code/genie-cli/genie && bun run test`

Expected: All existing tests pass. The smoke config is separate and won't interfere.

- [ ] **Step 4: Commit**

```bash
git add genie/vitest.smoke.config.ts genie/package.json
git commit -m "test(smoke): add vitest smoke config and test:smoke script"
```

---

### Task 3: Run Smoke Test

**Files:**
- Create: `genie/test/smoke/smoke.run.test.ts`

- [ ] **Step 1: Write the run smoke test**

Create `genie/test/smoke/smoke.run.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { checkProvider } from './support/provider-check.js'

const projectRoot = fileURLToPath(new URL('../..', import.meta.url))
const bunBinary = execFileSync('which', ['bun'], { encoding: 'utf8' }).trim() || 'bun'
const sourceCliPath = join(projectRoot, 'src', 'bin', 'genie.ts')

const providers = ['claude', 'codex', 'gemini', 'cursor-agent'] as const

describe('smoke: run', () => {
  describe.each(providers)('provider: %s', (providerId) => {
    it('returns a response containing "hello"', ({ skip }) => {
      const status = checkProvider(providerId)
      if (!status.available) {
        skip(`${providerId} unavailable: ${status.reason}`)
        return
      }

      const result = spawnSync(
        bunBinary,
        [sourceCliPath, 'run', 'Respond with exactly one word: hello', '--provider', providerId],
        {
          encoding: 'utf8',
          timeout: 55_000,
          env: { ...process.env },
          cwd: projectRoot,
        },
      )

      expect(result.status, `exit code should be 0. stderr: ${result.stderr}`).toBe(0)
      const output = (result.stdout + result.stderr).toLowerCase()
      expect(output).toContain('hello')
    })
  })
})
```

- [ ] **Step 2: Run the smoke suite to verify it works (tests will skip or pass based on local providers)**

Run: `cd /Users/dallascrilley/Code/genie-cli/genie && bun run test:smoke`

Expected: Each provider either passes (if locally available and authenticated) or skips with a reason message. No failures.

- [ ] **Step 3: Commit**

```bash
git add genie/test/smoke/smoke.run.test.ts
git commit -m "test(smoke): add run round-trip smoke test for all providers"
```

---

### Task 4: Commit Smoke Test

**Files:**
- Create: `genie/test/smoke/smoke.commit.test.ts`

- [ ] **Step 1: Write the commit smoke test**

Create `genie/test/smoke/smoke.commit.test.ts`:

```typescript
import { describe, it, expect, afterAll } from 'vitest'
import { spawnSync, execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { checkProvider } from './support/provider-check.js'

const projectRoot = fileURLToPath(new URL('../..', import.meta.url))
const bunBinary = execFileSync('which', ['bun'], { encoding: 'utf8' }).trim() || 'bun'
const sourceCliPath = join(projectRoot, 'src', 'bin', 'genie.ts')

const providers = ['claude', 'codex', 'gemini', 'cursor-agent'] as const

function createStagedRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'genie-smoke-commit-'))
  execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' })
  execFileSync('git', ['config', 'user.name', 'Smoke Test'], { cwd: dir, stdio: 'ignore' })
  execFileSync('git', ['config', 'user.email', 'smoke@test.local'], { cwd: dir, stdio: 'ignore' })

  // Create initial commit so HEAD exists
  writeFileSync(join(dir, 'README.md'), '# test\n', 'utf8')
  execFileSync('git', ['add', 'README.md'], { cwd: dir, stdio: 'ignore' })
  execFileSync('git', ['commit', '-m', 'init'], { cwd: dir, stdio: 'ignore' })

  // Stage a one-line change
  writeFileSync(join(dir, 'version.txt'), 'version = 2\n', 'utf8')
  execFileSync('git', ['add', 'version.txt'], { cwd: dir, stdio: 'ignore' })

  return dir
}

describe('smoke: commit', () => {
  const tempDirs: string[] = []

  afterAll(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  describe.each(providers)('provider: %s', (providerId) => {
    it('generates a non-empty commit message', ({ skip }) => {
      const status = checkProvider(providerId)
      if (!status.available) {
        skip(`${providerId} unavailable: ${status.reason}`)
        return
      }

      const repoDir = createStagedRepo()
      tempDirs.push(repoDir)

      const result = spawnSync(
        bunBinary,
        [sourceCliPath, 'commit', '--provider', providerId],
        {
          encoding: 'utf8',
          timeout: 55_000,
          env: { ...process.env },
          cwd: repoDir,
        },
      )

      expect(result.status, `exit code should be 0. stderr: ${result.stderr}`).toBe(0)
      const output = (result.stdout + result.stderr).trim()
      expect(output.length).toBeGreaterThanOrEqual(5)
    })
  })
})
```

- [ ] **Step 2: Run the smoke suite to verify both test files work**

Run: `cd /Users/dallascrilley/Code/genie-cli/genie && bun run test:smoke`

Expected: All tests either pass or skip. No failures. Temp directories are cleaned up.

- [ ] **Step 3: Commit**

```bash
git add genie/test/smoke/smoke.commit.test.ts
git commit -m "test(smoke): add commit message generation smoke test for all providers"
```

---

### Task 5: CI Workflow

**Files:**
- Create: `.github/workflows/smoke.yml`

- [ ] **Step 1: Create the smoke CI workflow**

Create `.github/workflows/smoke.yml`:

```yaml
name: Smoke Tests

on:
  workflow_dispatch:
  schedule:
    - cron: '0 6 * * *'

jobs:
  smoke:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: genie
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.3.10

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Build and link
        run: |
          bun run build
          bun link

      - name: Run smoke tests
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
        run: bun run test:smoke
```

- [ ] **Step 2: Validate the workflow YAML syntax**

Run: `cd /Users/dallascrilley/Code/genie-cli && python3 -c "import yaml; yaml.safe_load(open('.github/workflows/smoke.yml'))"`

Expected: No errors (valid YAML).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/smoke.yml
git commit -m "ci: add nightly + manual smoke test workflow"
```

---

### Task 6: Verify Everything Together

- [ ] **Step 1: Run the existing test suite to confirm no regressions**

Run: `cd /Users/dallascrilley/Code/genie-cli/genie && bun run test`

Expected: All existing unit and integration tests pass.

- [ ] **Step 2: Run the smoke suite**

Run: `cd /Users/dallascrilley/Code/genie-cli/genie && bun run test:smoke`

Expected: Tests pass for locally available providers, skip for unavailable ones. Zero failures.

- [ ] **Step 3: Run typecheck**

Run: `cd /Users/dallascrilley/Code/genie-cli/genie && bun run typecheck`

Expected: No type errors.
