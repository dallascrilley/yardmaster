import { type ProviderId } from '../types.js'
import { listProviderAdapters } from './registry.js'
import { doctorProviderStatus, resolveDoctorTargets } from './doctor-helpers.js'
import type { ProviderDoctorStatus } from './doctor-types.js'

export type { ProviderDoctorStatus } from './doctor-types.js'

export async function listProviders(): Promise<Array<{ id: ProviderId }>> {
  const entries = listProviderAdapters()
  return entries.map((entry: { id: ProviderId }) => ({ id: entry.id }))
}

export async function doctorProviders(provider?: string): Promise<ProviderDoctorStatus[]> {
  const targets = resolveDoctorTargets(provider)
  return Promise.all(targets.map((entry) => doctorProviderStatus(entry)))
}
