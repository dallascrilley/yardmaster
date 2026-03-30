import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { existsSync, rmSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createGenieClient } from '../src/acp/host-handlers.js'
import type { StreamEvent } from '../src/acp/types.js'

const thisFile = fileURLToPath(import.meta.url)

describe('createGenieClient', () => {
  describe('readTextFile', () => {
    it('reads the contents of a real file', async () => {
      const events: StreamEvent[] = []
      const client = createGenieClient({
        workspace: '/tmp',
        trustMode: 'trust',
        onEvent: (e) => events.push(e),
      })

      const result = await client.readTextFile!({
        path: thisFile,
        sessionId: 'test-session',
      })

      expect(typeof result.content).toBe('string')
      expect(result.content.length).toBeGreaterThan(0)
      expect(result.content).toContain('createGenieClient')
    })

    it('respects line and limit params', async () => {
      const client = createGenieClient({
        workspace: '/tmp',
        trustMode: 'trust',
        onEvent: () => {},
      })

      const full = await client.readTextFile!({
        path: thisFile,
        sessionId: 'test-session',
      })

      const fullLines = full.content.split('\n')

      const partial = await client.readTextFile!({
        path: thisFile,
        sessionId: 'test-session',
        line: 1,
        limit: 3,
      })

      const partialLines = partial.content.split('\n')
      expect(partialLines.length).toBe(3)
      expect(partialLines[0]).toBe(fullLines[0])
    })
  })

  describe('requestPermission', () => {
    it('auto-approves the first allow option in trust mode', async () => {
      const client = createGenieClient({
        workspace: '/tmp',
        trustMode: 'trust',
        onEvent: () => {},
      })

      const response = await client.requestPermission({
        sessionId: 'test-session',
        options: [
          { optionId: 'opt-allow', kind: 'allow_once', name: 'Allow once' },
          { optionId: 'opt-deny', kind: 'reject_once', name: 'Deny' },
        ],
        toolCall: {
          toolCallId: 'tc-1',
          title: 'Read file',
          rawInput: {},
        },
      })

      expect(response.outcome.outcome).toBe('selected')
      if (response.outcome.outcome === 'selected') {
        expect(response.outcome.optionId).toBe('opt-allow')
      }
    })

    it('auto-approves first option in yolo mode', async () => {
      const client = createGenieClient({
        workspace: '/tmp',
        trustMode: 'yolo',
        onEvent: () => {},
      })

      const response = await client.requestPermission({
        sessionId: 'test-session',
        options: [
          { optionId: 'opt-reject', kind: 'reject_once', name: 'Deny' },
        ],
        toolCall: {
          toolCallId: 'tc-2',
          title: 'Delete file',
          rawInput: {},
        },
      })

      expect(response.outcome.outcome).toBe('selected')
      if (response.outcome.outcome === 'selected') {
        expect(response.outcome.optionId).toBe('opt-reject')
      }
    })

    it('denies (cancelled) in default mode', async () => {
      const client = createGenieClient({
        workspace: '/tmp',
        trustMode: 'default',
        onEvent: () => {},
      })

      const response = await client.requestPermission({
        sessionId: 'test-session',
        options: [
          { optionId: 'opt-allow', kind: 'allow_once', name: 'Allow once' },
        ],
        toolCall: {
          toolCallId: 'tc-3',
          title: 'Write file',
          rawInput: {},
        },
      })

      expect(response.outcome.outcome).toBe('cancelled')
    })
  })

  describe('sessionUpdate', () => {
    it('emits a content StreamEvent for agent_message_chunk with text block', async () => {
      const events: StreamEvent[] = []
      const client = createGenieClient({
        workspace: '/tmp',
        trustMode: 'default',
        onEvent: (e) => events.push(e),
      })

      await client.sessionUpdate({
        sessionId: 'test-session',
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: 'Hello from agent' },
        },
      })

      expect(events).toHaveLength(1)
      expect(events[0]).toEqual({ kind: 'content', text: 'Hello from agent' })
    })

    it('emits a tool-call StreamEvent for tool_call update', async () => {
      const events: StreamEvent[] = []
      const client = createGenieClient({
        workspace: '/tmp',
        trustMode: 'default',
        onEvent: (e) => events.push(e),
      })

      await client.sessionUpdate({
        sessionId: 'test-session',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 'tc-42',
          title: 'read_file',
          rawInput: { path: '/foo/bar' },
        },
      })

      expect(events).toHaveLength(1)
      const ev = events[0]
      expect(ev?.kind).toBe('tool-call')
      if (ev?.kind === 'tool-call') {
        expect(ev.name).toBe('read_file')
        expect(ev.params).toContain('/foo/bar')
      }
    })

    it('emits a plan StreamEvent for plan update', async () => {
      const events: StreamEvent[] = []
      const client = createGenieClient({
        workspace: '/tmp',
        trustMode: 'default',
        onEvent: (e) => events.push(e),
      })

      await client.sessionUpdate({
        sessionId: 'test-session',
        update: {
          sessionUpdate: 'plan',
          entries: [
            { content: 'Step 1', status: 'in_progress', priority: 'high' },
            { content: 'Step 2', status: 'pending', priority: 'low' },
          ],
        },
      })

      expect(events).toHaveLength(1)
      const ev = events[0]
      expect(ev?.kind).toBe('plan')
      if (ev?.kind === 'plan') {
        expect(ev.entries).toHaveLength(2)
        expect(ev.entries[0]?.content).toBe('Step 1')
        expect(ev.entries[0]?.status).toBe('in_progress')
      }
    })

    it('does not emit for non-content block types', async () => {
      const events: StreamEvent[] = []
      const client = createGenieClient({
        workspace: '/tmp',
        trustMode: 'default',
        onEvent: (e) => events.push(e),
      })

      await client.sessionUpdate({
        sessionId: 'test-session',
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: {
            type: 'image',
            data: 'base64data',
            mimeType: 'image/png',
          },
        },
      })

      expect(events).toHaveLength(0)
    })
  })

  describe('writeTextFile', () => {
    it('throws in default mode', async () => {
      const client = createGenieClient({
        workspace: '/tmp',
        trustMode: 'default',
        onEvent: () => {},
      })

      await expect(
        client.writeTextFile!({
          path: '/tmp/genie-test-write.txt',
          content: 'hello',
          sessionId: 'test-session',
        }),
      ).rejects.toThrow(/Write denied/)
    })

    it('throws outside workspace in trust mode', async () => {
      const client = createGenieClient({
        workspace: '/tmp/my-workspace',
        trustMode: 'trust',
        onEvent: () => {},
      })

      await expect(
        client.writeTextFile!({
          path: '/etc/hosts',
          content: 'malicious',
          sessionId: 'test-session',
        }),
      ).rejects.toThrow(/Write denied/)
    })

    it('rejects path traversal attempt (../../etc/passwd) as outside workspace', async () => {
      const client = createGenieClient({
        workspace: '/tmp/my-workspace',
        trustMode: 'trust',
        onEvent: () => {},
      })

      await expect(
        client.writeTextFile!({
          path: '/tmp/my-workspace/../../etc/passwd',
          content: 'malicious',
          sessionId: 'test-session',
        }),
      ).rejects.toThrow(/Write denied/)
    })

    it('creates parent directories when writing to a nested path', async () => {
      const testWorkspace = `/tmp/genie-test-workspace-${Date.now()}`
      const nestedPath = join(testWorkspace, 'src', 'new-dir', 'file.ts')

      try {
        const client = createGenieClient({
          workspace: testWorkspace,
          trustMode: 'yolo',
          onEvent: () => {},
        })

        await client.writeTextFile!({
          path: nestedPath,
          content: 'export const x = 1',
          sessionId: 'test-session',
        })

        expect(existsSync(nestedPath)).toBe(true)
        const contents = await readFile(nestedPath, 'utf-8')
        expect(contents).toBe('export const x = 1')
      } finally {
        if (existsSync(testWorkspace)) {
          rmSync(testWorkspace, { recursive: true, force: true })
        }
      }
    })
  })

  describe('createTerminal + terminalOutput + releaseTerminal', () => {
    it('spawns a command and returns output', async () => {
      const client = createGenieClient({
        workspace: '/tmp',
        trustMode: 'trust',
        onEvent: () => {},
      })

      const { terminalId } = await client.createTerminal!({
        command: 'echo',
        args: ['hello-terminal'],
        sessionId: 'test-session',
      })

      expect(typeof terminalId).toBe('string')

      // wait briefly for process to complete
      await new Promise((r) => setTimeout(r, 100))

      const out = await client.terminalOutput!({
        terminalId,
        sessionId: 'test-session',
      })

      expect(out.output).toContain('hello-terminal')
      expect(out.truncated).toBe(false)

      await client.releaseTerminal!({
        terminalId,
        sessionId: 'test-session',
      })
    })

    it('releaseTerminal is a no-op for unknown terminal IDs', async () => {
      const client = createGenieClient({
        workspace: '/tmp',
        trustMode: 'trust',
        onEvent: () => {},
      })

      await expect(
        client.releaseTerminal!({
          terminalId: 'nonexistent-id',
          sessionId: 'test-session',
        }),
      ).resolves.toEqual({})
    })

    it('terminalOutput throws for unknown terminal IDs', async () => {
      const client = createGenieClient({
        workspace: '/tmp',
        trustMode: 'trust',
        onEvent: () => {},
      })

      await expect(
        client.terminalOutput!({
          terminalId: 'nonexistent-id',
          sessionId: 'test-session',
        }),
      ).rejects.toThrow(/Terminal not found/)
    })
  })
})
