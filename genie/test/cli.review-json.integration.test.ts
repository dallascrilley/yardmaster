import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('cli review json integration', () => {
  it('emits review json schema from spawned CLI execution', () => {
    const result = spawnSync('bun', ['src/bin/genie.ts', 'review', '--json-schema'], {
      cwd: new URL('..', import.meta.url).pathname,
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')

    const parsed = JSON.parse(result.stdout)
    expect(parsed).toMatchObject({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      title: 'Genie Review Result',
      type: 'object',
    })
    expect(parsed.properties.kind.const).toBe('review_result')
    expect(parsed.properties.version.const).toBe(1)
    expect(parsed.properties.ok.type).toBe('boolean')
    expect(parsed.properties.exitCode.enum).toEqual([0, 1])
    expect(parsed.properties.error.type).toBe('null')
    expect(parsed.required).toContain('results')
  })
})
