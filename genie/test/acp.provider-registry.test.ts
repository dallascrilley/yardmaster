import { describe, it, expect } from 'vitest';
import { getAcpProvider, listAcpProviders } from '../src/acp/provider-registry.js';

describe('getAcpProvider', () => {
  it('returns claude entry with agentCommand npx and correct args', () => {
    const entry = getAcpProvider('claude');
    expect(entry).toBeDefined();
    expect(entry?.agentCommand).toBe('npx');
    expect(entry?.args).toContain('@zed-industries/claude-agent-acp');
  });

  it('returns codex entry with agentCommand npx', () => {
    const entry = getAcpProvider('codex');
    expect(entry).toBeDefined();
    expect(entry?.agentCommand).toBe('npx');
  });

  it('returns gemini entry with agentCommand gemini', () => {
    const entry = getAcpProvider('gemini');
    expect(entry).toBeDefined();
    expect(entry?.agentCommand).toBe('gemini');
  });

  it('returns undefined for cursor-agent', () => {
    const entry = getAcpProvider('cursor-agent');
    expect(entry).toBeUndefined();
  });
});

describe('listAcpProviders', () => {
  it('returns 3 entries with ids claude, codex, and gemini', () => {
    const providers = listAcpProviders();
    expect(providers).toHaveLength(3);
    const ids = providers.map((p) => p.id);
    expect(ids).toContain('claude');
    expect(ids).toContain('codex');
    expect(ids).toContain('gemini');
  });
});
