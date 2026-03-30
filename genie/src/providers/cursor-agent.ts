import { createProviderAdapter, extractResponseText } from './base.js'
import { type NormalizedRequest } from '../types.js'
import { applyCursorMappedArgs } from './mapped-args/cursor.js'

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
  authCheck: async (runner) => {
    // #region agent log
    const authStart = Date.now()
    const authCwd = process.cwd()
    fetch('http://127.0.0.1:7245/ingest/deedbb81-19f4-481d-a235-c804fadbd424', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '69e54e' }, body: JSON.stringify({ sessionId: '69e54e', location: 'cursor-agent.ts:authCheck', message: 'cursor-agent authCheck started', data: { cwd: authCwd, timeoutMs: 10_000 }, timestamp: authStart, hypothesisId: 'H1' }) }).catch(() => {})
    // #endregion
    const result = await runner({
      command: 'cursor-agent',
      args: ['auth', 'status'],
      timeoutMs: 10_000,
      cwd: process.cwd(),
    })
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/deedbb81-19f4-481d-a235-c804fadbd424', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '69e54e' }, body: JSON.stringify({ sessionId: '69e54e', location: 'cursor-agent.ts:authCheck', message: 'cursor-agent authCheck finished', data: { code: result.code, durationMs: Date.now() - authStart, timeout: result.code === 124, stderrLen: (result.stderr || '').length }, timestamp: Date.now(), hypothesisId: 'H1' }) }).catch(() => {})
    // #endregion

    if (result.code === 0) {
      return {
        ok: true,
        details: (result.stdout || result.stderr).trim() || undefined,
      }
    }

    const details = [result.stderr, result.stdout].filter(Boolean).join('\n').trim()
    if (result.code === 124) {
      return {
        ok: false,
        reason: 'cursor-agent authentication check timed out',
        hint: 'cursor-agent did not respond to `auth status`. Open Cursor, confirm you are signed in, and trust/approve this workspace for agent access before retrying.',
        authFailure: true,
        timeout: true,
        code: result.code,
        details: details || undefined,
      }
    }

    return {
      ok: false,
      reason: 'cursor-agent authentication check failed',
      hint: details || 'Open Cursor, confirm you are signed in, and trust/approve this workspace for agent access before retrying.',
      authFailure: true,
      code: result.code,
    }
  },
})
