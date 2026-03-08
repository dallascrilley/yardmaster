import { createProviderAdapter, extractResponseText } from './base.js'
import { type CommandResult, type NormalizedRequest } from '../types.js'
import { applyCodexMappedArgs } from './mapped-args/codex.js'
import { codexAuthCheck } from './codex-auth.js'

function buildInvocation(request: NormalizedRequest) {
  const args = ['exec', request.prompt]
  applyCodexMappedArgs(args, request)

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
  authCheck: codexAuthCheck,
})
