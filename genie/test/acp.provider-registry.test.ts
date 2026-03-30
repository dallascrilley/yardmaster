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

  it('returns gemini entry with --acp for documented ACP mode', () => {
    const entry = getAcpProvider('gemini')
    expect(entry).toBeDefined()
    expect(entry?.agentCommand).toBe('gemini')
    expect(entry?.args).toEqual(['--acp'])
  })

  it('returns cursor-agent entry with agent acp and cursor_login', () => {
    const entry = getAcpProvider('cursor-agent')
    expect(entry).toBeDefined()
    expect(entry?.args).toEqual(['acp'])
    expect(entry?.acpAuthenticateMethodId).toBe('cursor_login')
    expect(entry?.agentCommand).toBeTruthy()
  })
})

describe('listAcpProviders', () => {
  it('returns 4 entries including claude, codex, gemini, and cursor-agent', () => {
    const providers = listAcpProviders()
    expect(providers).toHaveLength(4)
    const ids = providers.map((p) => p.id)
    expect(ids).toContain('claude')
    expect(ids).toContain('codex')
    expect(ids).toContain('gemini')
    expect(ids).toContain('cursor-agent')
  })
})
