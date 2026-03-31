import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
   saveSession,
   loadSession,
   deleteSession,
   listSessions,
   setSessionsFilePath,
   resetSessionsFilePath,
   touchSession,
} from '../src/acp/session-store.js'
import type { ProviderId } from '../src/types.js'

describe('session-store', () => {
   let tempDir: string
   let sessionsFile: string

   beforeEach(() => {
      tempDir = mkdtempSync(join(tmpdir(), 'genie-sessions-'))
      sessionsFile = join(tempDir, 'sessions.json')
      setSessionsFilePath(sessionsFile)
   })

   afterEach(() => {
      resetSessionsFilePath()
      try {
         rmSync(tempDir, { recursive: true })
      } catch { }
   })

   it('saves and loads a session', async () => {
      await saveSession('test-session', {
         sessionId: 'abc-123',
         agentCommand: 'npx',
         args: ['@zed-industries/codex-acp'],
         cwd: '/tmp/test',
         provider: 'codex' as ProviderId,
      })

      const loaded = await loadSession('test-session')
      expect(loaded).toBeDefined()
      expect(loaded?.sessionId).toBe('abc-123')
      expect(loaded?.provider).toBe('codex')
      expect(loaded?.cwd).toBe('/tmp/test')
      expect(loaded?.agentCommand).toBe('npx')
   })

   it('returns undefined for non-existent session', async () => {
      const loaded = await loadSession('does-not-exist')
      expect(loaded).toBeUndefined()
   })

   it('deletes a session', async () => {
      await saveSession('to-delete', {
         sessionId: 'xyz-789',
         agentCommand: 'npx',
         cwd: '/tmp',
         provider: 'claude' as ProviderId,
      })

      await deleteSession('to-delete')
      const loaded = await loadSession('to-delete')
      expect(loaded).toBeUndefined()
   })

   it('lists all sessions', async () => {
      await saveSession('session-1', {
         sessionId: 'id-1',
         agentCommand: 'npx',
         cwd: '/tmp/1',
         provider: 'claude' as ProviderId,
      })
      await saveSession('session-2', {
         sessionId: 'id-2',
         agentCommand: 'gemini',
         cwd: '/tmp/2',
         provider: 'gemini' as ProviderId,
      })

      const sessions = await listSessions()
      expect(sessions).toHaveLength(2)
      expect(sessions.map((s) => s.name)).toContain('session-1')
      expect(sessions.map((s) => s.name)).toContain('session-2')
   })

   it('cleans up expired sessions on load', async () => {
      // Save a session with lastActiveAt 25 hours ago
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
      await saveSession('expired', {
         sessionId: 'old',
         agentCommand: 'npx',
         cwd: '/tmp',
         provider: 'claude' as ProviderId,
         createdAt: oldDate,
      })

      // Manually update lastActiveAt to be old (saveSession sets it to now)
      const { readFile, writeFile } = await import('node:fs/promises')
      const content = await readFile(sessionsFile, 'utf-8')
      const store = JSON.parse(content)
      store['expired'].lastActiveAt = oldDate
      await writeFile(sessionsFile, JSON.stringify(store, null, 2))

      // Now load should clean it up
      const loaded = await loadSession('expired')
      expect(loaded).toBeUndefined()

      // Should also be removed from list
      const sessions = await listSessions()
      expect(sessions.find((s) => s.name === 'expired')).toBeUndefined()
   })

   it('preserves createdAt on subsequent saves', async () => {
      await saveSession('persistent', {
         sessionId: 'id-1',
         agentCommand: 'npx',
         cwd: '/tmp',
         provider: 'claude' as ProviderId,
      })

      const first = await loadSession('persistent')
      const createdAt = first?.createdAt

      // Wait a tiny bit and save again
      await new Promise((r) => setTimeout(r, 10))
      await saveSession('persistent', {
         sessionId: 'id-1',
         agentCommand: 'npx',
         cwd: '/tmp',
         provider: 'claude' as ProviderId,
         createdAt,
      })

      const second = await loadSession('persistent')
      expect(second?.createdAt).toBe(createdAt)
      expect(second?.lastActiveAt).not.toBe(first?.lastActiveAt)
   })
   it('preserves all sessions across concurrent saves', async () => {
      await Promise.all(
         Array.from({ length: 12 }, (_, index) =>
            saveSession(`session-${index}`, {
               sessionId: `id-${index}`,
               agentCommand: 'npx',
               cwd: `/tmp/${index}`,
               provider: 'claude' as ProviderId,
            }),
         ),
      )

      const sessions = await listSessions()
      expect(sessions).toHaveLength(12)
      expect(new Set(sessions.map((entry) => entry.name))).toHaveLength(12)
   })

   it('does not revive expired sessions when touchSession runs', async () => {
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
      await saveSession('expired-touch', {
         sessionId: 'expired-touch-id',
         agentCommand: 'npx',
         cwd: '/tmp/expired-touch',
         provider: 'claude' as ProviderId,
         createdAt: oldDate,
      })

      const { readFile, writeFile } = await import('node:fs/promises')
      const content = await readFile(sessionsFile, 'utf-8')
      const store = JSON.parse(content)
      store['expired-touch'].lastActiveAt = oldDate
      await writeFile(sessionsFile, JSON.stringify(store, null, 2))

      await touchSession('expired-touch')

      expect(await loadSession('expired-touch')).toBeUndefined()
      expect((await listSessions()).find((entry) => entry.name === 'expired-touch')).toBeUndefined()
   })
})
