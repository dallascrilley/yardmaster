import { describe, it, expect } from 'vitest'
import { getAcpProvider, listAcpProviders } from '../src/acp/provider-registry.js'

describe('getAcpProvider', () => {
  it('returns claude entry with either a stable binary or npx fallback', () => {
    const entry = getAcpProvider('claude')
    expect(entry).toBeDefined()
    expect(entry?.agentCommand).toBeTruthy()
    if (entry?.agentCommand === 'npx') {
      expect(entry.args).toContain('@zed-industries/claude-agent-acp')
    } else {
      expect(entry?.agentCommand.endsWith('claude-agent-acp')).toBe(true)
      expect(entry?.args ?? []).toEqual([])
    }
  })

  it('returns codex entry with either a stable binary or npx fallback', () => {
    const entry = getAcpProvider('codex')
    expect(entry).toBeDefined()
    expect(entry?.agentCommand).toBeTruthy()
    if (entry?.agentCommand === 'npx') {
      expect(entry.args).toContain('@zed-industries/codex-acp')
    } else {
      expect(entry?.agentCommand.endsWith('codex-acp')).toBe(true)
      expect(entry?.args ?? []).toEqual([])
    }
  })

  it('returns gemini entry with agentCommand gemini', () => {
    const entry = getAcpProvider('gemini')
    expect(entry).toBeDefined()
    expect(entry?.agentCommand).toBe('gemini')
  })

  it('returns undefined for cursor-agent', () => {
    const entry = getAcpProvider('cursor-agent')
    expect(entry).toBeUndefined()
  })
})

describe('listAcpProviders', () => {
  it('returns 3 entries with ids claude, codex, and gemini', () => {
    const providers = listAcpProviders()
    expect(providers).toHaveLength(3)
    const ids = providers.map((p) => p.id)
    expect(ids).toContain('claude')
    expect(ids).toContain('codex')
    expect(ids).toContain('gemini')
  })
})
