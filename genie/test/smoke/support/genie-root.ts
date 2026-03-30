import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

export function resolveGeniePackageRoot(): string {
  const fromMeta = fileURLToPath(new URL('../../..', import.meta.url))
  if (existsSync(join(fromMeta, 'src', 'bin', 'genie.ts'))) {
    return fromMeta
  }
  const cwd = process.cwd()
  if (existsSync(join(cwd, 'src', 'bin', 'genie.ts'))) {
    return cwd
  }
  throw new Error('Cannot resolve genie package root (expected src/bin/genie.ts)')
}
