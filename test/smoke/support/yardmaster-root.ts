import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

export function resolveYardmasterPackageRoot(): string {
  const fromMeta = fileURLToPath(new URL('../../..', import.meta.url))
  if (existsSync(join(fromMeta, 'src', 'bin', 'yardmaster.ts'))) {
    return fromMeta
  }
  const cwd = process.cwd()
  if (existsSync(join(cwd, 'src', 'bin', 'yardmaster.ts'))) {
    return cwd
  }
  throw new Error('Cannot resolve yardmaster package root (expected src/bin/yardmaster.ts)')
}
