import { doctorProviders, listProviders } from '../../../providers/doctor.js'
import { shouldUseJson, writeJson, writeLine, writeVerbose } from '../../output.js'
import { toCliJsonSuccessEnvelope } from '../../json.js'
import type { ParsedCommand } from '../../types.js'

export async function handleProvidersListCommand(parsed: Extract<ParsedCommand, { kind: 'providers-list' }>): Promise<void> {
  const providers = await listProviders()
  writeVerbose(parsed.globals, `[yardmaster] command=providers-list count=${providers.length}`)
  if (shouldUseJson(parsed.globals)) {
    writeJson(toCliJsonSuccessEnvelope('providers_list', { providers }))
    return
  }
  for (const provider of providers) {
    writeLine(provider.id)
  }
}

export async function handleProvidersDoctorCommand(parsed: Extract<ParsedCommand, { kind: 'providers-doctor' }>): Promise<void> {
  const report = await doctorProviders(parsed.provider, { showIdentity: parsed.showIdentity === true })
  if (shouldUseJson(parsed.globals)) {
    writeJson(toCliJsonSuccessEnvelope('providers_doctor', { providers: report }))
    return
  }

  for (const status of report) {
    const line = [
      status.provider,
      status.available ? 'available' : 'missing',
      status.authenticated ? 'authenticated' : 'unauthenticated',
      `${status.latencyMs}ms`,
    ].join(' | ')
    writeLine(line)
    if (status.hint && !parsed.globals.quiet) {
      process.stderr.write(`hint (${status.provider}): ${status.hint}\n`)
    }
    writeVerbose(
      parsed.globals,
      `[yardmaster] command=providers-doctor provider=${status.provider} available=${String(status.available)} authenticated=${String(status.authenticated)} latencyMs=${status.latencyMs}`,
    )
  }
}
