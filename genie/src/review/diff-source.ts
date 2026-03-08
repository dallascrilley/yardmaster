import { readFileSync } from 'node:fs'

import { UsageError } from '../errors.js'
import { createGitService, type GitReadFn, type GitService } from './git-service.js'

type FileReadFn = (path: string, encoding: BufferEncoding) => string

function defaultFileRead(path: string, encoding: BufferEncoding): string {
  return readFileSync(path, encoding)
}

export function resolveReviewDiffSource(params?: {
  diffFile?: string
  staged?: boolean
  base?: string
  gitService?: GitService
  gitRead?: GitReadFn
  fileRead?: FileReadFn
}): { source: string; text: string } {
  const gitService = params?.gitService ?? createGitService({ gitRead: params?.gitRead })
  const fileRead = params?.fileRead ?? defaultFileRead

  if (params?.diffFile) {
    try {
      const text = fileRead(params.diffFile, 'utf8')
      return { source: `file:${params.diffFile}`, text }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      throw new UsageError(`Unable to read --diff-file '${params.diffFile}': ${reason}`)
    }
  }

  if (params?.staged) {
    return gitService.resolveDiffSource({ staged: true })
  }

  if (params?.base) {
    return gitService.resolveDiffSource({ base: params.base })
  }

  return gitService.resolveDiffSource()
}

export function ensureNonEmptyDiff(text: string): string {
  const normalized = text.trim()
  if (!normalized) {
    throw new UsageError(
      'No changes to review. Provide --diff-file <path>, create local changes, or switch to a branch with commits.',
    )
  }
  return text
}
