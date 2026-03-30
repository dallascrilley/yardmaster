import type { ProviderId } from '../types.js'

/** Registry entry mapping a provider to its ACP agent command. */
export type AcpProviderEntry = {
  readonly id: ProviderId
  readonly agentCommand: string
  readonly args?: readonly string[]
  readonly resolveEnv?: () => Record<string, string>
  readonly authCheck?: () => Promise<boolean>
  /** When set, `authenticate` is called after `initialize` (e.g. Cursor `cursor_login`). */
  readonly acpAuthenticateMethodId?: string
}

export type SessionHandle = {
  readonly sessionId: string
  readonly provider: ProviderId
  readonly agentCommand: string
  readonly cwd: string
}

export type PlanEntry = {
  readonly content: string
  readonly status: 'pending' | 'in_progress' | 'completed'
  readonly priority?: 'high' | 'medium' | 'low'
}

export type StreamEvent =
  | { readonly kind: 'content'; readonly text: string }
  | { readonly kind: 'tool-call'; readonly name: string; readonly params: string }
  | { readonly kind: 'tool-result'; readonly name: string; readonly result: string }
  | { readonly kind: 'plan'; readonly entries: readonly PlanEntry[] }
  | { readonly kind: 'done'; readonly stopReason: string }

/** Persisted session entry for session store. */
export type PersistedSession = {
  readonly sessionId: string
  readonly agentCommand: string
  readonly args?: readonly string[]
  readonly cwd: string
  readonly provider: ProviderId
  readonly createdAt: string // ISO 8601
  readonly lastActiveAt: string // ISO 8601
}
