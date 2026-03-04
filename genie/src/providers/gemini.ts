import { createProviderAdapter, extractResponseText } from './base.js'
import { type NormalizedRequest } from '../types.js'

function buildInvocation(request: NormalizedRequest) {
  const args = ['chat', request.prompt]

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
})
