import type { ProviderId } from '../types.js';
import type { AcpProviderEntry } from './types.js';

/** Environment variable names for model selection per provider. */
export const modelEnvVars: Record<ProviderId, string> = {
  claude: 'ANTHROPIC_MODEL',
  codex: 'OPENAI_MODEL',
  gemini: 'GEMINI_MODEL',
  'cursor-agent': 'CURSOR_MODEL',
};

const registry: ReadonlyMap<ProviderId, AcpProviderEntry> = new Map([
  ['claude', {
    id: 'claude',
    agentCommand: 'npx',
    args: ['@zed-industries/claude-agent-acp'],
  }],
  ['codex', {
    id: 'codex',
    agentCommand: 'npx',
    args: ['@zed-industries/codex-acp'],
  }],
  ['gemini', {
    id: 'gemini',
    agentCommand: 'gemini',
    resolveEnv: (): Record<string, string> => {
      const key = process.env.GEMINI_API_KEY;
      return key ? { GEMINI_API_KEY: key } : {};
    },
  }],
]);

export function getAcpProvider(id: ProviderId): AcpProviderEntry | undefined {
  return registry.get(id);
}

export function listAcpProviders(): AcpProviderEntry[] {
  return [...registry.values()];
}
