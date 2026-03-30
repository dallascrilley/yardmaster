import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import type { PersistedSession, ProviderId } from './types.js'

const DEFAULT_SESSIONS_FILE = join(homedir(), '.config', 'genie', 'sessions.json')

function getSessionsFile(): string {
  return customSessionsFile ?? DEFAULT_SESSIONS_FILE
}
const TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

type SessionStore = {
  readonly [name: string]: PersistedSession
}

async function ensureDir(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
}

async function readStore(): Promise<SessionStore> {
  try {
    const content = await readFile(getSessionsFile(), 'utf-8')
    const parsed = JSON.parse(content) as SessionStore
    return parsed ?? {}
  } catch {
    return {}
  }
}

async function writeStore(store: SessionStore): Promise<void> {
  await ensureDir(getSessionsFile())
  await writeFile(getSessionsFile(), JSON.stringify(store, null, 2), 'utf-8')
}

function isExpired(session: PersistedSession): boolean {
  const lastActive = new Date(session.lastActiveAt).getTime()
  return Date.now() - lastActive > TTL_MS
}

function cleanupExpired(store: SessionStore): SessionStore {
  const cleaned: SessionStore = {}
  for (const [name, session] of Object.entries(store)) {
    if (!isExpired(session)) {
      cleaned[name] = session
    }
  }
  return cleaned
}

/**
 * Save a session to the store.
 */
export async function saveSession(
  name: string,
  session: Omit<PersistedSession, 'createdAt' | 'lastActiveAt'> & { createdAt?: string },
): Promise<void> {
  const store = cleanupExpired(await readStore())
  const now = new Date().toISOString()
  const persisted: PersistedSession = {
    ...session,
    createdAt: session.createdAt ?? now,
    lastActiveAt: now,
  }
  const updated = { ...store, [name]: persisted }
  await writeStore(updated)
}

/**
 * Load a session from the store.
 * Returns undefined if not found or expired.
 */
export async function loadSession(name: string): Promise<PersistedSession | undefined> {
  const store = cleanupExpired(await readStore())
  const session = store[name]
  if (!session) return undefined
  if (isExpired(session)) return undefined
  return session
}

/**
 * Update the lastActiveAt timestamp for a session.
 */
export async function touchSession(name: string): Promise<void> {
  const store = await readStore()
  const session = store[name]
  if (!session) return
  const updated = {
    ...store,
    [name]: { ...session, lastActiveAt: new Date().toISOString() },
  }
  await writeStore(updated)
}

/**
 * Delete a session from the store.
 */
export async function deleteSession(name: string): Promise<void> {
  const store = await readStore()
  const { [name]: _, ...rest } = store
  await writeStore(rest)
}

/**
 * List all active sessions.
 */
export async function listSessions(): Promise<Array<{ name: string; session: PersistedSession }>> {
  const store = cleanupExpired(await readStore())
  return Object.entries(store).map(([name, session]) => ({ name, session }))
}

/**
 * Get the path to the sessions file.
 */
export function getSessionsFilePath(): string {
  return getSessionsFile()
}

/**
 * Set a custom sessions file path (for testing).
 */
let customSessionsFile: string | undefined

export function setSessionsFilePath(path: string): void {
  customSessionsFile = path
}

export function resetSessionsFilePath(): void {
  customSessionsFile = undefined
}
