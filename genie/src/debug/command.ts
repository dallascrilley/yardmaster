import { UsageError } from '../errors.js'
import { normalizeTextInput, readTextInput } from '../cli/input.js'

export const emptyDebugInputMessage = [
  'No terminal error input provided.',
  'Pipe terminal output into `genie debug`, for example:',
  '  npm test 2>&1 | genie debug',
].join('\n')

export function normalizeDebugInput(raw: string): string {
  return normalizeTextInput(raw, emptyDebugInputMessage)
}

export function readDebugInput(inputFile?: string): string {
  if (!inputFile && process.stdin.isTTY === true) {
    throw new UsageError(emptyDebugInputMessage)
  }

  return normalizeDebugInput(readTextInput(inputFile))
}

export const DEBUG_SYSTEM_PROMPT = `You are diagnosing terminal output from a developer workflow.
Identify the single most likely root cause from the provided terminal output.
Return a concise response with these sections:
1. Root cause
2. Why it happened
3. Next step
4. Confidence
Do not quote the entire log back. If the log is ambiguous or incomplete, say so explicitly and avoid certainty.`

export function buildDebugPrompt(input: string): string {
  return `Analyze this terminal output and identify the root cause:

\`\`\`text
${input}
\`\`\``
}
