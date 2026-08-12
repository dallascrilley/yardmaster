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
  /**
   * True when identity redaction was applied to the detail fields. It says the
   * filter ran, not that the output is provably free of identifying values.
   */
  identityRedacted: boolean
  latencyMs: number
}
