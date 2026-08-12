import { type ProviderId } from '../types.js'

export type ProviderDoctorStatus = {
  provider: ProviderId
  available: boolean
  authenticated: boolean
  availabilityDetails?: string
  authDetails?: string
  hint?: string
  latencyMs: number
}
