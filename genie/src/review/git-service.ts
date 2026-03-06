import { execFileSync } from 'node:child_process'

import { UsageError } from '../errors.js'

const GIT_MAX_BUFFER_BYTES = 20 * 1024 * 1024

export type GitContext = {
  branch: string | null
  head: string | null
}

export type GitDiffSource = {
  source: string
  text: string
}

export type GitReadFn = (args: string[]) => string

type GitReadResult =
  | { ok: true; text: string }
  | { ok: false; error: string }

export type GitService = {
  read: GitReadFn
  resolveContext: () => GitContext
  resolveDiffSource: (params?: { staged?: boolean; base?: string }) => GitDiffSource
}

export function defaultGitRead(args: string[]): string {
  return execFileSync('git', args, {
    encoding: 'utf8',
    maxBuffer: GIT_MAX_BUFFER_BYTES,
  })
}

function safeGitRead(gitRead: GitReadFn, args: string[]): GitReadResult {
  try {
    return { ok: true, text: gitRead(args) }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return { ok: false, error: reason }
  }
}

function resolveGitContext(gitRead: GitReadFn): GitContext {
  const branchResult = safeGitRead(gitRead, ['rev-parse', '--abbrev-ref', 'HEAD'])
  const headResult = safeGitRead(gitRead, ['rev-parse', '--short', 'HEAD'])
  const branch = branchResult.ok ? branchResult.text.trim() || null : null
  const head = headResult.ok ? headResult.text.trim() || null : null
  return { branch, head }
}

function buildBaseRefCandidates(gitRead: GitReadFn): string[] {
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

function isUnbornHeadError(message: string): boolean {
  return /unknown revision or path not in the working tree|bad revision 'HEAD'|ambiguous argument 'HEAD'|not a valid object name HEAD/i.test(
    message,
  )
}

function loadHeadDiffWithUnbornFallback(gitRead: GitReadFn): GitDiffSource {
  const againstHead = safeGitRead(gitRead, ['diff', '--no-color', 'HEAD'])
  if (againstHead.ok) {
    return { source: 'git diff HEAD', text: againstHead.text }
  }

  if (!isUnbornHeadError(againstHead.error)) {
    throw new UsageError(`Failed to read git diff HEAD: ${againstHead.error}`)
  }

  const cached = safeGitRead(gitRead, ['diff', '--no-color', '--cached'])
  const working = safeGitRead(gitRead, ['diff', '--no-color'])

  const parts: string[] = []
  if (cached.ok && cached.text.trim()) parts.push(cached.text)
  if (working.ok && working.text.trim()) parts.push(working.text)

  if (parts.length > 0) {
    return {
      source: 'git diff --cached + git diff',
      text: parts.join('\n'),
    }
  }

  if (!cached.ok && !working.ok) {
    throw new UsageError(
      `Failed to read git diff for repository without commits. cached: ${cached.error}. working: ${working.error}`,
    )
  }

  return {
    source: 'git diff --cached + git diff',
    text: '',
  }
}

function resolveGitDiffSource(gitRead: GitReadFn, params?: { staged?: boolean; base?: string }): GitDiffSource {
  if (params?.staged) {
    const stagedDiff = safeGitRead(gitRead, ['diff', '--no-color', '--cached'])
    if (!stagedDiff.ok) {
      throw new UsageError(`Failed to read git diff --cached: ${stagedDiff.error}`)
    }
    return {
      source: 'git diff --cached',
      text: stagedDiff.text,
    }
  }

  if (params?.base) {
    const mergeBaseResult = safeGitRead(gitRead, ['merge-base', 'HEAD', params.base])
    if (!mergeBaseResult.ok) {
      throw new UsageError(`Failed to resolve --base '${params.base}': ${mergeBaseResult.error}`)
    }

    const mergeBase = mergeBaseResult.text.trim()
    if (!mergeBase) {
      throw new UsageError(`Failed to resolve --base '${params.base}': empty merge-base`)
    }

    const baseDiff = safeGitRead(gitRead, ['diff', '--no-color', `${mergeBase}...HEAD`])
    if (!baseDiff.ok) {
      throw new UsageError(`Failed to read diff for --base '${params.base}': ${baseDiff.error}`)
    }

    return {
      source: `git diff ${params.base}...HEAD`,
      text: baseDiff.text,
    }
  }

  const dirtyOrStaged = loadHeadDiffWithUnbornFallback(gitRead)
  if (dirtyOrStaged.text.trim()) {
    return dirtyOrStaged
  }

  const candidateErrors: string[] = []
  let successfulCandidateReads = 0
  for (const baseRef of buildBaseRefCandidates(gitRead)) {
    const mergeBaseResult = safeGitRead(gitRead, ['merge-base', 'HEAD', baseRef])
    if (!mergeBaseResult.ok) {
      candidateErrors.push(`${baseRef}: ${mergeBaseResult.error}`)
      continue
    }

    const mergeBase = mergeBaseResult.text.trim()
    if (!mergeBase) continue

    const branchDiffResult = safeGitRead(gitRead, ['diff', '--no-color', `${mergeBase}...HEAD`])
    if (!branchDiffResult.ok) {
      candidateErrors.push(`${baseRef}: ${branchDiffResult.error}`)
      continue
    }
    successfulCandidateReads += 1

    if (branchDiffResult.text.trim()) {
      return {
        source: `git diff ${baseRef}...HEAD`,
        text: branchDiffResult.text,
      }
    }
  }

  if (successfulCandidateReads === 0 && candidateErrors.length > 0) {
    throw new UsageError(
      `Failed to resolve base branch diff candidates:\n- ${candidateErrors.slice(0, 4).join('\n- ')}`,
    )
  }

  return dirtyOrStaged
}

export function createGitService(params?: { gitRead?: GitReadFn }): GitService {
  const gitRead = params?.gitRead ?? defaultGitRead
  return {
    read: gitRead,
    resolveContext: () => resolveGitContext(gitRead),
    resolveDiffSource: (resolveParams?: { staged?: boolean; base?: string }) =>
      resolveGitDiffSource(gitRead, resolveParams),
  }
}
