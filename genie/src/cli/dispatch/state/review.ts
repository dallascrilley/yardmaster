import { loadConfig } from '../../../config/store.js'
import {
  executeReviewCommand,
  formatReviewReport,
  getReviewJsonSchema,
  toReviewJsonEnvelope,
} from '../../../review/command.js'
import type { ReviewAgentProgress } from '../../../review/command.js'
import { shouldUseJson, writeJson, writeLine, writeVerbose } from '../../output.js'
import type { ParsedCommand } from '../../types.js'

function formatElapsed(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${Math.round(ms / 1000)}s`
}

function writeProgress(parsed: Extract<ParsedCommand, { kind: 'review' }>, progress: ReviewAgentProgress): void {
  if (shouldUseJson(parsed.globals)) return
  if (progress.event === 'started') {
    process.stderr.write(`  ${progress.agent}: reviewing...\n`)
  } else if (progress.event === 'settled' && progress.result) {
    const r = progress.result
    const elapsed = formatElapsed(r.latencyMs)
    if (r.status === 'ok') {
      process.stderr.write(`  ${r.agent}: done (${elapsed})\n`)
    } else {
      process.stderr.write(`  ${r.agent}: failed (${elapsed})\n`)
    }
  }
}

export async function handleReviewCommand(parsed: Extract<ParsedCommand, { kind: 'review' }>): Promise<void> {
  if (parsed.options.jsonSchema) {
    writeJson(getReviewJsonSchema())
    return
  }

  const config = await loadConfig()
  const result = await executeReviewCommand({
    all: parsed.options.all,
    agent: parsed.options.agent,
    diffFile: parsed.options.diffFile,
    staged: parsed.options.staged,
    base: parsed.options.base,
    config,
    onProgress: (progress) => writeProgress(parsed, progress),
  })

  if (shouldUseJson(parsed.globals)) {
    const envelope = toReviewJsonEnvelope(result)
    writeJson({
      kind: envelope.kind,
      version: envelope.version,
      ok: result.exitCode === 0,
      mode: envelope.mode,
      targets: envelope.targets,
      source: envelope.source,
      cwd: envelope.cwd,
      git: envelope.git,
      diff: envelope.diff,
      summary: envelope.summary,
      results: envelope.results,
      exitCode: envelope.exitCode,
      error: null,
    })
  } else {
    writeLine(formatReviewReport(result))
  }

  if (result.exitCode !== 0) {
    process.exitCode = result.exitCode
  }
  writeVerbose(
    parsed.globals,
    `[genie] command=review mode=${result.mode} targets=${result.agents.join(',')} exitCode=${result.exitCode} source=${result.source}`,
  )
}
