import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const projectRoot = fileURLToPath(new URL('../../..', import.meta.url))
const bunResult = spawnSync('which', ['bun'], { encoding: 'utf8' })
const bunBinary = bunResult.status === 0 ? bunResult.stdout.trim() : 'bun'
const sourceCliPath = join(projectRoot, 'src', 'bin', 'genie.ts')

export type ProviderStatus = { available: boolean; reason?: string }

type DoctorEnvelope = {
  ok: boolean
  providers: Array<{
    provider: string
    available: boolean
    authenticated: boolean
    availabilityDetails?: string
    authDetails?: string
  }>
}

let cachedStatuses: Map<string, ProviderStatus> | undefined

function loadStatuses(): Map<string, ProviderStatus> {
  if (cachedStatuses) return cachedStatuses

  cachedStatuses = new Map()

  let raw: string
  try {
    const result = spawnSync(bunBinary, [sourceCliPath, 'providers', 'doctor', '--json'], {
      encoding: 'utf8',
      timeout: 30_000,
    })
    if (result.status !== 0) return cachedStatuses
    raw = result.stdout
  } catch {
    return cachedStatuses
  }

  let envelope: DoctorEnvelope
  try {
    envelope = JSON.parse(raw)
  } catch {
    return cachedStatuses
  }

  for (const entry of envelope.providers) {
    if (entry.available && entry.authenticated) {
      cachedStatuses.set(entry.provider, { available: true })
    } else {
      const reasons: string[] = []
      if (!entry.available) reasons.push(entry.availabilityDetails ?? 'binary not found')
      if (!entry.authenticated) reasons.push(entry.authDetails ?? 'not authenticated')
      cachedStatuses.set(entry.provider, { available: false, reason: reasons.join('; ') })
    }
  }

  return cachedStatuses
}

export function checkProvider(providerId: string): ProviderStatus {
  const statuses = loadStatuses()
  return statuses.get(providerId) ?? { available: false, reason: 'not in doctor output' }
}
