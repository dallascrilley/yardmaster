import {
  formatCliError,
  getExitCode,
} from './errors.js'
import { executeCommand } from './cli/dispatch.js'
import { toCliJsonErrorEnvelope } from './cli/json.js'
import {
  writeJson,
} from './cli/output.js'
import { parseArgv } from './cli/parse.js'
import type { GlobalOptions } from './cli/types.js'

export { parseArgv } from './cli/parse.js'

async function withGlobalFlagEnvironment<T>(globals: GlobalOptions | undefined, run: () => Promise<T>): Promise<T> {
  if (!globals || (!globals.noColor && !globals.noInput)) {
    return run()
  }

  const previousNoColor = process.env.NO_COLOR
  const previousCi = process.env.CI

  if (globals.noColor) {
    process.env.NO_COLOR = '1'
  }
  if (globals.noInput) {
    process.env.CI = 'true'
  }

  try {
    return await run()
  } finally {
    if (previousNoColor === undefined) {
      delete process.env.NO_COLOR
    } else {
      process.env.NO_COLOR = previousNoColor
    }

    if (previousCi === undefined) {
      delete process.env.CI
    } else {
      process.env.CI = previousCi
    }
  }
}

export async function runFromArgv(
  argv: string[],
  deps?: { confirm?: (prompt: string) => Promise<boolean> },
): Promise<void> {
  const parsed = parseArgv(argv)
  const globals = 'globals' in parsed ? parsed.globals : undefined
  await withGlobalFlagEnvironment(globals, async () => executeCommand(parsed, deps))
}

export async function cli(argv: string[] = process.argv.slice(2)): Promise<void> {
  try {
    await runFromArgv(argv)
  } catch (error) {
    const code = getExitCode(error)
    const message = formatCliError(error)
    const optionArgs = argv.includes('--') ? argv.slice(0, argv.indexOf('--')) : argv
    const wantsJson = optionArgs.includes('--json') && !optionArgs.includes('--plain')

    if (wantsJson) {
      writeJson(toCliJsonErrorEnvelope(code, { code: String(code), message }))
    } else {
      process.stderr.write(`${message}\n`)
    }
    process.exitCode = code
  }
}
