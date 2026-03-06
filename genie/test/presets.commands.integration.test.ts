import { mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

import { afterEach, describe, expect, it } from 'vitest'

import { deletePreset, getPreset, listPresets, previewDeletePreset, previewSetPreset, previewUsePreset, setPreset, usePreset } from '../src/presets/commands.js'

describe('presets commands', () => {
  const homes: string[] = []
  const originalHome = process.env.HOME

  afterEach(() => {
    for (const home of homes) {
      rmSync(home, { recursive: true, force: true })
    }
    homes.length = 0
    process.env.HOME = originalHome
  })

  it('supports set/get/list/use/delete workflows', async () => {
    const home = join(tmpdir(), `genie-presets-${randomUUID()}`)
    mkdirSync(home, { recursive: true })
    homes.push(home)
    process.env.HOME = home

    const created = await setPreset(
      'default-headless',
      {
        provider: 'codex',
        yolo: true,
        includeDirectories: ['src', 'docs'],
        outputFormat: 'json',
        headless: true,
      },
      { setDefault: true },
    )
    expect(created.name).toBe('default-headless')
    expect(created.default).toBe('default-headless')

    const fetched = await getPreset('default-headless')
    expect(fetched.provider).toBe('codex')
    expect(fetched.yolo).toBe(true)

    const listed = await listPresets()
    expect(listed.default).toBe('default-headless')
    expect(listed.named['default-headless']).toBeTruthy()

    const used = await usePreset('default-headless')
    expect(used.default).toBe('default-headless')

    const deleted = await deletePreset('default-headless')
    expect(deleted.deleted).toBe('default-headless')
    expect(deleted.default).toBeUndefined()
  })

  it('supports dry-run previews without mutating presets', async () => {
    const home = join(tmpdir(), `genie-presets-${randomUUID()}`)
    mkdirSync(home, { recursive: true })
    homes.push(home)
    process.env.HOME = home

    const createPreview = await previewSetPreset('nightly', { provider: 'codex' }, { setDefault: true })
    expect(createPreview.name).toBe('nightly')
    expect(createPreview.default).toBe('nightly')
    expect(createPreview.replaced).toBe(false)

    await setPreset('nightly', { provider: 'codex' }, { setDefault: true })

    const overwritePreview = await previewSetPreset('nightly', { provider: 'gemini' })
    expect(overwritePreview.replaced).toBe(true)
    expect((await getPreset('nightly')).provider).toBe('codex')

    await setPreset('stable', { provider: 'codex' }, { setDefault: true })
    expect((await listPresets()).default).toBe('stable')

    const usePreview = await previewUsePreset('nightly')
    expect(usePreview.default).toBe('nightly')
    expect((await listPresets()).default).toBe('stable')

    const deletePreview = await previewDeletePreset('nightly')
    expect(deletePreview.deleted).toBe('nightly')
    expect((await getPreset('nightly')).provider).toBe('codex')
  })
})
