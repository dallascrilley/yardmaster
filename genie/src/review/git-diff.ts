import { UsageError } from '../errors.js'
import type { GitDiffSource, GitReadFn } from './git-service.js'
import { buildBaseRefCandidates, safeGitRead } from './git-context.js'

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

export function resolveGitDiffSource(gitRead: GitReadFn, params?: { staged?: boolean; base?: string }): GitDiffSource {
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

  const candidates = buildBaseRefCandidates(gitRead)
  if (candidates.length === 0) {
    throw new UsageError(
      'No base branch candidates found. Ensure a remote is configured or a main/master branch exists locally.',
    )
  }

  const candidateErrors: string[] = []
  let successfulCandidateReads = 0
  for (const baseRef of candidates) {
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
