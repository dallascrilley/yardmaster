import { createProviderAdapter, extractResponseText } from './base.js'
import { type NormalizedRequest, type CommandRunner, type ProviderCheckResult } from '../types.js'
import { applyClaudeMappedArgs } from './mapped-args/claude.js'
import { isLikelyTimeout } from './command-runner.js'

function buildClaudeEnv(): Record<string, string> {
  const env: Record<string, string> = { ...process.env } as Record<string, string>
  delete env.ANTHROPIC_API_KEY
  return env
}

function buildInvocation(request: NormalizedRequest) {
  const args = [request.prompt]
  applyClaudeMappedArgs(args, request)

  return {
    command: 'claude',
    args,
    cwd: request.workspace,
    timeoutMs: request.timeoutMs,
    env: buildClaudeEnv(),
  }
}

function parse(result: { stdout: string; stderr: string; code: number }) {
  return {
    text: extractResponseText(result, 'claude'),
    raw: result,
  }
}

async function claudeAuthCheck(runner: CommandRunner): Promise<ProviderCheckResult> {
  const result = await runner({
    command: 'claude',
    args: ['auth', 'status'],
    timeoutMs: 4_000,
    env: buildClaudeEnv(),
  })

  if (result.code === 0) {
    return {
      ok: true,
      details: (result.stdout || result.stderr).trim() || undefined,
    }
  }

  return {
    ok: false,
    reason: 'claude authentication check failed',
    hint: result.stderr || result.stdout || 'Authenticate with the Claude Code CLI and retry.',
    authFailure: true,
    timeout: isLikelyTimeout(result),
    code: result.code,
  }
}

export const claudeAdapter = createProviderAdapter({
  id: 'claude',
  binary: 'claude',
  buildInvocation,
  parse,
  availabilityInvocation: {
    command: 'claude',
    args: ['--version'],
    env: buildClaudeEnv(),
  },
  authCheck: (runner) => claudeAuthCheck(runner),
})
