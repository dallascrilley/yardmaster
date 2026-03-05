import { createProviderAdapter, extractResponseText } from './base.js'
import { type NormalizedRequest } from '../types.js'
import { applyGeminiMappedArgs } from './mapped-args.js'

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
  availabilityCheck: async (runner) => {
    const result = await runner({
      command: 'which',
      args: ['gemini'],
      timeoutMs: 1_500,
    })

    if (result.code === 0) {
      return {
        ok: true,
        details: result.stdout.trim() || 'gemini found on PATH',
      }
    }

    return {
      ok: false,
      reason: 'gemini is not available on PATH',
      hint: result.stderr || result.stdout || 'Install Gemini CLI and ensure gemini is on PATH.',
      timeout: result.code === 124,
    }
  },
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
