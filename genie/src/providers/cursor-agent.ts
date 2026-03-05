import { createProviderAdapter, extractResponseText } from './base.js'
import { type NormalizedRequest } from '../types.js'
import { applyCursorMappedArgs } from './mapped-args.js'

function buildInvocation(request: NormalizedRequest) {
  const args = [request.prompt]
  applyCursorMappedArgs(args, request)

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
