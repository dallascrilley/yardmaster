import { createProviderAdapter, extractResponseText } from './base.js'
import { type NormalizedRequest } from '../types.js'
import { applyClaudeMappedArgs } from './mapped-args.js'

function buildInvocation(request: NormalizedRequest) {
  const args = [request.prompt]
  applyClaudeMappedArgs(args, request)

  return {
    command: 'claude',
    args,
    cwd: request.workspace,
    timeoutMs: request.timeoutMs,
  }
}

function parse(result: { stdout: string; stderr: string; code: number }) {
  return {
    text: extractResponseText(result, 'claude'),
    raw: result,
  }
}

export const claudeAdapter = createProviderAdapter({
  id: 'claude',
  binary: 'claude',
  buildInvocation,
  parse,
})
