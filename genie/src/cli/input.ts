import { readFileSync } from 'node:fs'

import { UsageError } from '../errors.js'

export function readTextInput(path?: string): string {
  const source = path === '-' ? undefined : path

  try {
    if (source) {
      return readFileSync(source, 'utf8')
    }
    return readFileSync(0, 'utf8')
  } catch {
    const label = path && path !== '-' ? `input file '${path}'` : 'stdin'
    throw new UsageError(`Failed to read ${label}`)
  }
}

export function normalizeTextInput(raw: string, emptyMessage: string): string {
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new UsageError(emptyMessage)
  }
  return trimmed
}
