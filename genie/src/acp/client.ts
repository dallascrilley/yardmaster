import { spawn, type ChildProcess } from 'node:child_process'
import { Readable, Writable } from 'node:stream'
import { ClientSideConnection, ndJsonStream, PROTOCOL_VERSION, RequestError } from '@agentclientprotocol/sdk'
import type { Client } from '@agentclientprotocol/sdk'
import { AcpProtocolError, RuntimeProviderError, TimeoutError } from '../errors.js'
import { createGenieClient, type TrustMode } from './host-handlers.js'
import type { AcpProviderEntry, StreamEvent } from './types.js'
import { modelEnvVars } from './provider-registry.js'

export type AcpClientOptions = {
  workspace: string
  trustMode: TrustMode
  timeoutMs: number
  onEvent: (event: StreamEvent) => void
  mcpServers?: unknown[]
  model?: string
}

export class AcpClient {
  private child: ChildProcess | null = null
  private connection: ClientSideConnection | null = null
  private sessionId: string | null = null

  constructor(
    private readonly entry: AcpProviderEntry,
    private readonly options: AcpClientOptions,
  ) {}

  /** Returns the current session ID if a session is active. */
  getSessionId(): string | null {
    return this.sessionId
  }

  /** One-shot: spawn, init, session, prompt, close. Returns the stop reason. */
  async run(prompt: string): Promise<string> {
    try {
      await this.spawnAndInit()
      await this.createSession(this.options.model)
      return await this.sendPrompt(prompt)
    } catch (err) {
      if (err instanceof RequestError) {
        throw new AcpProtocolError(err.code, err.message, this.entry.id)
      }
      if (err instanceof Error && 'code' in err && typeof (err as { code: unknown }).code === 'number') {
        throw new AcpProtocolError((err as { code: number }).code, err.message, this.entry.id)
      }
      throw err
    } finally {
      this.close()
    }
  }

  /**
   * Resume a session by ID. Tries session/load first, falls back to session/new.
   * Must be called before prompt().
   */
  async resume(sessionId: string): Promise<boolean> {
    if (!this.connection) {
      await this.spawnAndInit()
    }

    // Try to load existing session
    try {
      const result = await this.connection!.loadSession({ sessionId })
      if (result.sessionId === sessionId) {
        this.sessionId = sessionId
        return true
      }
    } catch {
      // Load failed, fall through to create new session
    }

    // Fallback: create new session
    await this.createSession()
    return false
  }

  /**
   * Send a prompt to the active session.
   * Must be called after run() or resume() has established a session.
   */
  async prompt(text: string): Promise<string> {
    return this.sendPrompt(text)
  }

  private async spawnAndInit(): Promise<void> {
    const { agentCommand, args = [], resolveEnv, id } = this.entry
    const env: NodeJS.ProcessEnv = { ...process.env, ...(resolveEnv?.() ?? {}) }
    
    // Set model via env var as fallback for adapters that don't support session/model
    if (this.options.model) {
      const modelEnvVar = modelEnvVars[id]
      if (modelEnvVar) {
        env[modelEnvVar] = this.options.model
      }
    }

    this.child = spawn(agentCommand, [...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
    })

    let stderrBuffer = ''
    this.child.stderr?.on('data', (chunk: Buffer) => {
      stderrBuffer += chunk.toString()
    })

    await new Promise<void>((resolve, reject) => {
      const onError = (err: Error): void => {
        cleanup()
        const stderrSuffix = stderrBuffer.trim() ? `\nstderr: ${stderrBuffer.trim()}` : ''
        reject(
          new RuntimeProviderError(
            `ACP agent spawn failed for ${this.entry.id}: ${err.message}${stderrSuffix}`,
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
      const stderrSuffix = stderrBuffer.trim() ? `\nstderr: ${stderrBuffer.trim()}` : ''
      throw new RuntimeProviderError(
        `ACP initialization failed for ${this.entry.id}: no response from agent${stderrSuffix}`,
      )
    }
  }

  private async createSession(model?: string): Promise<void> {
    if (!this.connection) throw new Error('Not initialized')

    const result = await this.connection.newSession({
      cwd: this.options.workspace,
      mcpServers: (this.options.mcpServers ?? []) as Parameters<
        ClientSideConnection['newSession']
      >[0]['mcpServers'],
    })

    this.sessionId = result.sessionId

    // Try to set model if provided and supported
    if (model && this.sessionId) {
      await this.setModel(model).catch(() => {
        // Ignore errors - model selection is optional
      })
    }
  }

  /**
   * Set the model for the current session.
   * Uses unstable_setSessionModel if available.
   */
  private async setModel(model: string): Promise<void> {
    if (!this.connection || !this.sessionId) throw new Error('No active session')

    // Check if the connection supports setSessionModel
    if ('unstable_setSessionModel' in this.connection) {
      const setModelFn = (this.connection as unknown as { unstable_setSessionModel?: (params: { sessionId: string; modelId: string }) => Promise<unknown> }).unstable_setSessionModel
      if (setModelFn) {
        await setModelFn({ sessionId: this.sessionId, modelId: model })
      }
    }
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
