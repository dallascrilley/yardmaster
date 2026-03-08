import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { codexAdapter } from '../src/providers/codex.js'
import { geminiAdapter } from '../src/providers/gemini.js'
import { type CommandResult } from '../src/types.js'

describe('provider contract checks', () => {
  it('uses ~/.codex/auth.json token when codex auth status command is unsupported', async () => {
    const home = join(tmpdir(), `genie-codex-home-${randomUUID()}`)
    mkdirSync(join(home, '.codex'), { recursive: true })
    writeFileSync(
      join(home, '.codex', 'auth.json'),
      JSON.stringify({
        token: 'redacted',
      }),
    )

    const previousHome = process.env.HOME
    process.env.HOME = home

    let check: Awaited<ReturnType<typeof codexAdapter.isAuthenticated>>
    try {
      check = await codexAdapter.isAuthenticated(async () => {
        return {
          code: 1,
          stdout: '',
          stderr: 'Unknown command: auth status',
        } satisfies CommandResult
      })
    } finally {
      process.env.HOME = previousHome
      rmSync(home, { recursive: true, force: true })
    }

    expect(check.ok).toBe(true)
  })

  it('fails codex auth check when status is unsupported and token file is missing', async () => {
    const home = join(tmpdir(), `genie-codex-home-${randomUUID()}`)
    mkdirSync(home, { recursive: true })

    const previousHome = process.env.HOME
    process.env.HOME = home

    let check: Awaited<ReturnType<typeof codexAdapter.isAuthenticated>>
    try {
      check = await codexAdapter.isAuthenticated(async () => {
        return {
          code: 1,
          stdout: '',
          stderr: 'Unknown command: auth status',
        } satisfies CommandResult
      })
    } finally {
      process.env.HOME = previousHome
      rmSync(home, { recursive: true, force: true })
    }

    expect(check.ok).toBe(false)
  })

  it('does not treat arbitrary nested strings in tokens as auth tokens', async () => {
    const home = join(tmpdir(), `genie-codex-home-${randomUUID()}`)
    mkdirSync(join(home, '.codex'), { recursive: true })
    writeFileSync(
      join(home, '.codex', 'auth.json'),
      JSON.stringify({
        tokens: {
          default: {
            provider: 'openai',
          },
        },
      }),
    )

    const previousHome = process.env.HOME
    process.env.HOME = home

    let check: Awaited<ReturnType<typeof codexAdapter.isAuthenticated>>
    try {
      check = await codexAdapter.isAuthenticated(async () => {
        return {
          code: 1,
          stdout: '',
          stderr: 'Unknown command: auth status',
        } satisfies CommandResult
      })
    } finally {
      process.env.HOME = previousHome
      rmSync(home, { recursive: true, force: true })
    }

    expect(check.ok).toBe(false)
  })

  it('uses GEMINI_API_KEY for gemini auth checks', async () => {
    const previousKey = process.env.GEMINI_API_KEY
    process.env.GEMINI_API_KEY = 'redacted'

    let check: Awaited<ReturnType<typeof geminiAdapter.isAuthenticated>>
    try {
      check = await geminiAdapter.isAuthenticated(async () => {
        throw new Error('runner should not be called for gemini auth check')
      })
    } finally {
      process.env.GEMINI_API_KEY = previousKey
    }

    expect(check.ok).toBe(true)
  })
})
