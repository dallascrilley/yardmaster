import { readFileSync } from 'node:fs'

import { UsageError } from '../errors.js'

export function readTextInput(path?: string): string {
  const source = path === '-' ? undefined : path

  try {
    if (source) {
      return readFileSync(source, 'utf8')
    }
    return readFileSync(0, 'utf8')
  } catch (error) {
    const label = path && path !== '-' ? `input file '${path}'` : 'stdin'
    const detail = error instanceof Error ? error.message : String(error)
    throw new UsageError(`Failed to read ${label}: ${detail}`)
  }
}

export function normalizeTextInput(raw: string, emptyMessage: string): string {
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new UsageError(emptyMessage)
  }
  return trimmed
}
