import type { GitContext, GitReadFn } from './git-service.js'

type GitReadResult =
  | { ok: true; text: string }
  | { ok: false; error: string }

function safeGitRead(gitRead: GitReadFn, args: string[]): GitReadResult {
  try {
    return { ok: true, text: gitRead(args) }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return { ok: false, error: reason }
  }
}

export function resolveGitContext(gitRead: GitReadFn): GitContext {
  const branchResult = safeGitRead(gitRead, ['rev-parse', '--abbrev-ref', 'HEAD'])
  const headResult = safeGitRead(gitRead, ['rev-parse', '--short', 'HEAD'])
  const branch = branchResult.ok ? branchResult.text.trim() || null : null
  const head = headResult.ok ? headResult.text.trim() || null : null
  return { branch, head }
}

export function buildBaseRefCandidates(gitRead: GitReadFn): string[] {
  const candidates: string[] = []
  const upstream = safeGitRead(gitRead, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'])
  if (upstream.ok && upstream.text.trim()) {
    candidates.push(upstream.text.trim())
  }

  candidates.push('main', 'master', 'origin/main', 'origin/master')

  const originHead = safeGitRead(gitRead, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'])
  if (originHead.ok && originHead.text.trim()) {
    candidates.push(originHead.text.trim())
  }

  return [...new Set(candidates)]
}

export { safeGitRead }
