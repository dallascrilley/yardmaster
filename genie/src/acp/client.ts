import { spawn, type ChildProcess } from 'node:child_process'
import { Readable, Writable } from 'node:stream'
import { ClientSideConnection, ndJsonStream, PROTOCOL_VERSION } from '@agentclientprotocol/sdk'
import type { Client } from '@agentclientprotocol/sdk'
import { RuntimeProviderError, TimeoutError } from '../errors.js'
import { createGenieClient, type TrustMode } from './host-handlers.js'
import type { AcpProviderEntry, StreamEvent } from './types.js'

export type AcpClientOptions = {
  workspace: string
  trustMode: TrustMode
  timeoutMs: number
  onEvent: (event: StreamEvent) => void
  mcpServers?: unknown[]
}

export class AcpClient {
  private child: ChildProcess | null = null
  private connection: ClientSideConnection | null = null
  private sessionId: string | null = null

  constructor(
    private readonly entry: AcpProviderEntry,
    private readonly options: AcpClientOptions,
  ) {}

  /** One-shot: spawn, init, session, prompt, close. Returns the stop reason. */
  async run(prompt: string): Promise<string> {
    try {
      await this.spawnAndInit()
      await this.createSession()
      return await this.sendPrompt(prompt)
    } finally {
      this.close()
    }
  }

  private async spawnAndInit(): Promise<void> {
    const { agentCommand, args = [], resolveEnv } = this.entry
    const env = { ...process.env, ...(resolveEnv?.() ?? {}) }

    this.child = spawn(agentCommand, [...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
    })

    await new Promise<void>((resolve, reject) => {
      const onError = (err: Error): void => {
        cleanup()
        reject(
          new RuntimeProviderError(
            `ACP agent spawn failed for ${this.entry.id}: ${err.message}`,
          ),
        )
      }
      const onSpawn = (): void => {
        cleanup()
        resolve()
      }
      const cleanup = (): void => {
        this.child?.removeListener('error', onError)
        this.child?.removeListener('spawn', onSpawn)
      }
      this.child!.on('error', onError)
      this.child!.on('spawn', onSpawn)
    })

    const childStdin = this.child!.stdin!
    const childStdout = this.child!.stdout!

    const writableWeb = Writable.toWeb(childStdin) as WritableStream<Uint8Array>
    const readableWeb = Readable.toWeb(childStdout) as ReadableStream<Uint8Array>

    const stream = ndJsonStream(writableWeb, readableWeb)

    const genieClient: Client = createGenieClient({
      workspace: this.options.workspace,
      trustMode: this.options.trustMode,
      onEvent: this.options.onEvent,
    })

    this.connection = new ClientSideConnection(() => genieClient, stream)

    const initResult = await this.connection.initialize({
      protocolVersion: PROTOCOL_VERSION,
      clientCapabilities: {
        fs: { readTextFile: true, writeTextFile: true },
        terminal: true,
      },
      clientInfo: { name: 'genie', version: '0.1.0' },
    })

    if (!initResult) {
      throw new RuntimeProviderError(
        `ACP initialization failed for ${this.entry.id}: no response from agent`,
      )
    }
  }

  private async createSession(): Promise<void> {
    if (!this.connection) throw new Error('Not initialized')

    const result = await this.connection.newSession({
      cwd: this.options.workspace,
      mcpServers: (this.options.mcpServers ?? []) as Parameters<
        ClientSideConnection['newSession']
      >[0]['mcpServers'],
    })

    this.sessionId = result.sessionId
  }

  private async sendPrompt(text: string): Promise<string> {
    if (!this.connection || !this.sessionId) throw new Error('No active session')

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () =>
          reject(
            new TimeoutError(
              `ACP prompt timed out for ${this.entry.id} after ${this.options.timeoutMs}ms`,
            ),
          ),
        this.options.timeoutMs,
      )
    })

    const promptPromise = this.connection.prompt({
      sessionId: this.sessionId,
      prompt: [{ type: 'text', text }],
    })

    const result = await Promise.race([promptPromise, timeoutPromise])
    this.options.onEvent({ kind: 'done', stopReason: result.stopReason })
    return result.stopReason
  }

  close(): void {
    if (this.child && !this.child.killed) {
      this.child.kill('SIGTERM')
      const child = this.child
      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL')
        }
      }, 3000)
    }
    this.child = null
    this.connection = null
    this.sessionId = null
  }
}
