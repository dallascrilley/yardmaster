import { type ProviderId } from '../types.js'
import { claudeAdapter } from './claude.js'
import { codexAdapter } from './codex.js'
import { cursorAgentAdapter } from './cursor-agent.js'
import { geminiAdapter } from './gemini.js'

export const providerAdapters = [
  claudeAdapter,
  codexAdapter,
  cursorAgentAdapter,
  geminiAdapter,
]

export function getProviderAdapter(id: ProviderId) {
  return providerAdapters.find((item) => item.id === id)
}

