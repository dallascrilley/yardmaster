import type { GlobalOptions } from './types.js'
import { toCliJsonSuccessEnvelope } from './json.js'

export function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
}

export function writeLine(line: string): void {
  process.stdout.write(line)
  if (!line.endsWith('\n')) {
    process.stdout.write('\n')
  }
}

export function writeVerbose(globals: GlobalOptions, line: string): void {
  if (!globals.verbose) return
  process.stderr.write(`${line}\n`)
}

export function shouldUseJson(globals: GlobalOptions): boolean {
  return globals.json && !globals.plain
}

export function shouldWriteStatusOutput(globals: GlobalOptions): boolean {
  return !globals.quiet
}

export function writeCancellation(globals: GlobalOptions, kind: string, message: string): void {
  if (shouldUseJson(globals)) {
    writeJson(toCliJsonSuccessEnvelope(kind, { cancelled: true }))
    return
  }

  if (shouldWriteStatusOutput(globals)) {
    writeLine(message)
  }
}

export function writeConfigValue(value: unknown): void {
  if (typeof value === 'string') {
    writeLine(value)
    return
  }

  writeLine(JSON.stringify(value, null, 2))
}
