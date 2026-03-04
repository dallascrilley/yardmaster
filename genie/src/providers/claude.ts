import { createProviderAdapter } from './base.js'
import { type NormalizedRequest } from '../types.js'

function buildInvocation(request: NormalizedRequest) {
  const args = ['-p', request.prompt]

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
    command: 'claude',
    args,
    cwd: request.workspace,
  }
}

function parse(result: { stdout: string; stderr: string; code: number }) {
  const response = (result.stdout || result.stderr).trim()
  return {
    text: response || 'No response from claude',
    raw: result,
  }
}

export const claudeAdapter = createProviderAdapter({
  id: 'claude',
  binary: 'claude',
  buildInvocation,
  parse,
})
