import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { resolveGeniePackageRoot } from './genie-root.js'
import { spawnWithTimeout } from './async-spawn.js'

const projectRoot = resolveGeniePackageRoot()
const bunResult = spawnSync('which', ['bun'], { encoding: 'utf8' })
const bunBinary = bunResult.status === 0 ? bunResult.stdout.trim() : 'bun'
const sourceCliPath = join(projectRoot, 'src', 'bin', 'genie.ts')

export type ProviderStatus = { available: boolean; reason?: string }

type DoctorEntry = {
  provider: string
  available: boolean
  authenticated: boolean
  availabilityDetails?: string
  authDetails?: string
}

type DoctorEnvelope = {
  kind?: string
  ok?: boolean
  exitCode?: number
  providers?: DoctorEntry[]
}

let cachedStatuses: Map<string, ProviderStatus> | undefined
let loadStatusesPromise: Promise<Map<string, ProviderStatus>> | undefined

async function fetchStatusesIntoMap(): Promise<Map<string, ProviderStatus>> {
  const map = new Map<string, ProviderStatus>()
  try {
    const { status, stdout: raw } = await spawnWithTimeout(bunBinary, [sourceCliPath, 'providers', 'doctor', '--json'], {
      cwd: projectRoot,
      timeoutMs: 30_000,
    })
    if (status !== 0) {
      return map
    }

    let envelope: DoctorEnvelope
    try {
      envelope = JSON.parse(raw) as DoctorEnvelope
    } catch {
      return map
    }

    const providers = envelope.providers
    if (!Array.isArray(providers)) {
      return map
    }

    for (const entry of providers) {
      if (entry.available && entry.authenticated) {
        map.set(entry.provider, { available: true })
      } else {
        const reasons: string[] = []
        if (!entry.available) reasons.push(entry.availabilityDetails ?? 'binary not found')
        if (!entry.authenticated) reasons.push(entry.authDetails ?? 'not authenticated')
        map.set(entry.provider, { available: false, reason: reasons.join('; ') })
      }
    }

    return map
  } catch {
    return map
  }
}

function loadStatuses(): Promise<Map<string, ProviderStatus>> {
  if (cachedStatuses) {
    return Promise.resolve(cachedStatuses)
  }
  loadStatusesPromise ??= fetchStatusesIntoMap().then((map) => {
    cachedStatuses = map
    return map
  })
  return loadStatusesPromise
}

export async function checkProvider(providerId: string): Promise<ProviderStatus> {
  const statuses = await loadStatuses()
  return statuses.get(providerId) ?? { available: false, reason: 'not in doctor output' }
}
