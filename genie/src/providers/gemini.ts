import { createProviderAdapter, extractResponseText } from './base.js'
import { type NormalizedRequest } from '../types.js'
import { applyGeminiMappedArgs } from './mapped-args/gemini.js'

function buildInvocation(request: NormalizedRequest) {
  const args: string[] = []
  applyGeminiMappedArgs(args, request)

  return {
    command: 'gemini',
    args,
    cwd: request.workspace,
    timeoutMs: request.timeoutMs,
  }
}

function parse(result: { stdout: string; stderr: string; code: number }) {
  return {
    text: extractResponseText(result, 'gemini'),
    raw: result,
  }
}

export const geminiAdapter = createProviderAdapter({
  id: 'gemini',
  binary: 'gemini',
  buildInvocation,
  parse,
  authCheck: async () => {
    const apiKey = process.env.GEMINI_API_KEY?.trim()
    if (apiKey) {
      return {
        ok: true,
        details: 'Authenticated via GEMINI_API_KEY',
      }
    }

    return {
      ok: false,
      reason: 'gemini authentication not configured',
      hint: 'Set GEMINI_API_KEY and retry.',
      authFailure: true,
    }
  },
})
