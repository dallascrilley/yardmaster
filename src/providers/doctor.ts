import { type ProviderId } from '../types.js'
import { doctorProviderStatus, resolveDoctorTargets } from './doctor-helpers.js'
import type { DoctorOptions, ProviderDoctorStatus } from './doctor-types.js'

export type { DoctorOptions, ProviderDoctorStatus } from './doctor-types.js'

export async function listProviders(): Promise<Array<{ id: ProviderId }>> {
  const entries = resolveDoctorTargets()
  return entries.map((entry) => ({ id: entry.id }))
}

export async function doctorProviders(
  provider?: string,
  options: DoctorOptions = {},
): Promise<ProviderDoctorStatus[]> {
  const targets = resolveDoctorTargets(provider)
  return Promise.all(targets.map((entry) => doctorProviderStatus(entry, options)))
}
