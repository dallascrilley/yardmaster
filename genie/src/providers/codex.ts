import { createProviderAdapter, extractResponseText } from './base.js'
import { type CommandResult, type NormalizedRequest } from '../types.js'

function buildInvocation(request: NormalizedRequest) {
  const args = ['run', request.prompt]

  if (request.model) {
    args.push('--model', request.model)
  }

  if (request.mode && request.mode !== 'default') {
    args.push('--mode', request.mode)
  }

  if (request.trust) {
    args.push('--trust')
  }

  return {
    command: 'codex',
    args,
    cwd: request.workspace,
    timeoutMs: request.timeoutMs,
  }
}

function parse(result: CommandResult) {
  return {
    text: extractResponseText(result, 'codex'),
    raw: result,
  }
}

export const codexAdapter = createProviderAdapter({
  id: 'codex',
  binary: 'codex',
  buildInvocation,
  parse,
  authCheck: async (runner) => {
    const result = await runner({
      command: 'codex',
      args: ['auth', 'status'],
      timeoutMs: 4_000,
    })

    if (result.code === 0) {
      return { ok: true, details: (result.stdout || result.stderr).trim() || undefined }
    }

    const output = `${result.stderr}\n${result.stdout}`.toLowerCase()
    if (output.includes('unknown') || output.includes('unrecognized') || output.includes('usage')) {
      return {
        ok: true,
        details: 'codex auth status unsupported by installed CLI; skipped strict auth preflight',
      }
    }

    return {
      ok: false,
      reason: 'codex authentication check failed',
      hint: result.stderr || result.stdout || 'Run codex login and retry.',
      authFailure: true,
      timeout: result.code === 124,
      code: result.code,
    }
  },
})
