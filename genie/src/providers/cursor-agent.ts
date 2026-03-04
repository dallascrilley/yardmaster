import { createProviderAdapter, extractResponseText } from './base.js'
import { type NormalizedRequest } from '../types.js'

function buildInvocation(request: NormalizedRequest) {
  const args = ['chat', '--prompt', request.prompt]

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
    command: 'cursor-agent',
    args,
    cwd: request.workspace,
    timeoutMs: request.timeoutMs,
  }
}

function parse(result: { stdout: string; stderr: string; code: number }) {
  return {
    text: extractResponseText(result, 'cursor-agent'),
    raw: result,
  }
}

export const cursorAgentAdapter = createProviderAdapter({
  id: 'cursor-agent',
  binary: 'cursor-agent',
  buildInvocation,
  parse,
})
