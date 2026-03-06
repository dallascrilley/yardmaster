import { mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

import { afterEach, describe, expect, it } from 'vitest'

import { configGet, configInit, configPath, configSet, previewConfigInit, previewConfigSet } from '../src/config/commands.js'

describe('config commands', () => {
  const homes: string[] = []
  let originalHome = process.env.HOME

  afterEach(() => {
    for (const home of homes) {
      rmSync(home, { recursive: true, force: true })
    }
    homes.length = 0
    process.env.HOME = originalHome
  })

  it('supports init/get/set workflows', async () => {
    const home = join(tmpdir(), `genie-config-${randomUUID()}`)
    mkdirSync(home, { recursive: true })
    homes.push(home)
    process.env.HOME = home

    await configInit()
    await configSet('provider.default', 'codex')

    const provider = await configGet('provider.default')
    expect(provider).toBe('codex')

    const path = configPath()
    expect(path.user).toContain('.config/genie/config.json')
  })

  it('rejects invalid mode.default values', async () => {
    const home = join(tmpdir(), `genie-config-${randomUUID()}`)
    mkdirSync(home, { recursive: true })
    homes.push(home)
    process.env.HOME = home

    await configInit()

    await expect(configSet('mode.default', 'invalidmode')).rejects.toThrow(
      'mode.default must be one of: default, read-only, danger-full-access, ask, plan, freeform',
    )
  })

  it('supports dry-run previews without writing config', async () => {
    const home = join(tmpdir(), `genie-config-${randomUUID()}`)
    mkdirSync(home, { recursive: true })
    homes.push(home)
    process.env.HOME = home

    const initPreview = await previewConfigInit()
    expect(initPreview.exists).toBe(false)
    expect(initPreview.path).toContain('.config/genie/config.json')

    const setPreview = await previewConfigSet('provider.default', 'codex')
    expect(setPreview.provider.default).toBe('codex')

    const provider = await configGet('provider.default')
    expect(provider).not.toBe('codex')
  })
})
