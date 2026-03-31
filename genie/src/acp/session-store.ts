import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import type { PersistedSession } from './types.js'

const DEFAULT_SESSIONS_FILE = join(homedir(), '.config', 'genie', 'sessions.json')

function getSessionsFile(): string {
   return customSessionsFile ?? DEFAULT_SESSIONS_FILE
}
const TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

type SessionStore = {
   readonly [name: string]: PersistedSession
}

let writeChain: Promise<void> = Promise.resolve()

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
   const sessionsFile = getSessionsFile()
   const tempFile = `${sessionsFile}.${process.pid}.${Date.now()}.tmp`
   await ensureDir(sessionsFile)
   await writeFile(tempFile, JSON.stringify(store, null, 2), 'utf-8')
   await rename(tempFile, sessionsFile)
}

function isExpired(session: PersistedSession): boolean {
   const lastActive = new Date(session.lastActiveAt).getTime()
   return Date.now() - lastActive > TTL_MS
}

function cleanupExpired(store: SessionStore): SessionStore {
   const cleaned: Record<string, PersistedSession> = {}
   for (const [name, session] of Object.entries(store)) {
      if (!isExpired(session)) {
         cleaned[name] = session
      }
   }
   return cleaned
}

function storesEqual(left: SessionStore, right: SessionStore): boolean {
   return JSON.stringify(left) === JSON.stringify(right)
}

function withWriteLock<T>(work: () => Promise<T>): Promise<T> {
   const run = writeChain.then(work, work)
   writeChain = run.then(() => undefined, () => undefined)
   return run
}

async function mutateStore(mutator: (store: SessionStore) => SessionStore): Promise<void> {
   await withWriteLock(async () => {
      const rawStore = await readStore()
      const cleanedStore = cleanupExpired(rawStore)
      const updatedStore = mutator(cleanedStore)
      if (!storesEqual(rawStore, updatedStore)) {
         await writeStore(updatedStore)
      }
   })
}

/**
 * Save a session to the store.
 */
export async function saveSession(
   name: string,
   session: Omit<PersistedSession, 'createdAt' | 'lastActiveAt'> & { createdAt?: string },
): Promise<void> {
   await mutateStore((store) => {
      const now = new Date().toISOString()
      const persisted: PersistedSession = {
         ...session,
         createdAt: session.createdAt ?? store[name]?.createdAt ?? now,
         lastActiveAt: now,
      }
      return { ...store, [name]: persisted }
   })
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
   await mutateStore((store) => {
      const session = store[name]
      if (!session) return store
      return {
         ...store,
         [name]: { ...session, lastActiveAt: new Date().toISOString() },
      }
   })
}

/**
 * Delete a session from the store.
 */
export async function deleteSession(name: string): Promise<void> {
   await mutateStore((store) => {
      const { [name]: _removed, ...rest } = store
      return rest
   })
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
   writeChain = Promise.resolve()
}
