import { type ProviderId } from '../types.js'

export type DoctorOptions = {
  /**
   * Show the operator identity that provider CLIs print (email, org id, org
   * name). Off by default so `providers doctor` output is safe to paste.
   */
  showIdentity?: boolean
}

export type ProviderDoctorStatus = {
  provider: ProviderId
  available: boolean
  authenticated: boolean
  availabilityDetails?: string
  authDetails?: string
  hint?: string
  /** True when identity-bearing values in the detail fields were replaced. */
  identityRedacted: boolean
  latencyMs: number
}
