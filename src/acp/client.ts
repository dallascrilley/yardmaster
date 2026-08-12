import { spawn, type ChildProcess } from 'node:child_process'
import { Readable, Writable } from 'node:stream'
import { ClientSideConnection, ndJsonStream, PROTOCOL_VERSION } from '@agentclientprotocol/sdk'
import type { Client } from '@agentclientprotocol/sdk'
import { RuntimeProviderError, TimeoutError } from '../errors.js'
import { normalizeAcpSdkRejection } from './normalize-sdk-rejection.js'
import { createYardmasterClient, type TrustMode } from './host-handlers.js'
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
   ) { }

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
         throw normalizeAcpSdkRejection(err, this.entry.id)
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
      try {
         return await this.sendPrompt(text)
      } catch (err) {
         throw normalizeAcpSdkRejection(err, this.entry.id)
      }
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

      const yardmasterClient: Client = createYardmasterClient({
         workspace: this.options.workspace,
         trustMode: this.options.trustMode,
         onEvent: this.options.onEvent,
      })

      this.connection = new ClientSideConnection(() => yardmasterClient, stream)

      const initResult = await this.connection.initialize({
         protocolVersion: PROTOCOL_VERSION,
         clientCapabilities: {
            fs: { readTextFile: true, writeTextFile: true },
            terminal: true,
         },
         clientInfo: { name: 'yardmaster', version: '0.2.0' },
      })

      if (!initResult) {
         const stderrSuffix = stderrBuffer.trim() ? `\nstderr: ${stderrBuffer.trim()}` : ''
         throw new RuntimeProviderError(
            `ACP initialization failed for ${this.entry.id}: no response from agent${stderrSuffix}`,
         )
      }

      const authMethodId = this.entry.acpAuthenticateMethodId
      if (authMethodId) {
         await this.connection.authenticate({ methodId: authMethodId })
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

      let timeoutHandle: ReturnType<typeof setTimeout> | undefined
      const timeoutPromise = new Promise<never>((_, reject) => {
         timeoutHandle = setTimeout(
            () =>
               reject(
                  new TimeoutError(
                     `ACP prompt timed out for ${this.entry.id} after ${this.options.timeoutMs}ms`,
                  ),
               ),
            this.options.timeoutMs,
         )
         timeoutHandle.unref?.()
      })

      const promptPromise = this.connection.prompt({
         sessionId: this.sessionId,
         prompt: [{ type: 'text', text }],
      })

      let result: Awaited<typeof promptPromise>
      try {
         result = await Promise.race([promptPromise, timeoutPromise])
      } finally {
         if (timeoutHandle) {
            clearTimeout(timeoutHandle)
         }
      }
      this.options.onEvent({ kind: 'done', stopReason: result.stopReason })
      return result.stopReason
   }

   /**
    * Releases the agent subprocess and every handle that references it.
    *
    * The stdio teardown is load-bearing, not hygiene. `spawnAndInit` hands
    * `child.stdout` to `Readable.toWeb()` so `ndJsonStream` can read it, which
    * locks the socket behind a web-stream reader that is never cancelled. Once
    * the child is gone nothing drains that reader, so `child.stdout` never
    * reaches EOF, its `PipeWrap` stays referenced, and the event loop never
    * empties — the CLI printed its result and then hung forever. `child.stderr`
    * has the same problem via its buffering `data` listener. Destroying all
    * three sockets is what actually lets the process exit; `src/cli.ts` only
    * sets `process.exitCode` and relies on the loop draining.
    *
    * The child handle itself is deliberately *not* unref'd. Keeping it
    * referenced holds the loop open for the few milliseconds the agent needs to
    * act on SIGTERM, which is also what lets the escalation timer fire even
    * though it is unref'd. Unref'ing the child would let the CLI exit first and
    * reparent a live agent to PID 1.
    */
   close(): void {
      const child = this.child
      this.child = null
      this.connection = null

      if (!child) {
         return
      }

      // A signal-killed child keeps `exitCode === null` forever and reports the
      // signal in `signalCode`, so both have to be consulted. `?? null`
      // normalizes the not-yet-populated case.
      const hasExited = (): boolean =>
         (child.exitCode ?? null) !== null || (child.signalCode ?? null) !== null

      const destroyStdio = (): void => {
         // `child.stdin` is already destroyed by the ndJsonStream writer in the
         // normal path; `destroy()` on an already-destroyed stream is a no-op.
         child.stdin?.destroy()
         child.stdout?.destroy()
         child.stderr?.destroy()
      }

      // A child that never started has nothing to signal and will never emit
      // `exit`. Node reports that as `exitCode === -2`, but Bun leaves both
      // `exitCode` and `signalCode` null, so arming the escalation timer here
      // would stall every failed spawn by the escalation deadline — and
      // `fallback.ts` walks several providers per invocation.
      if (child.pid === undefined || hasExited()) {
         destroyStdio()
         return
      }

      let escalationTimer: ReturnType<typeof setTimeout> | undefined
      const onExit = (): void => {
         if (escalationTimer) {
            clearTimeout(escalationTimer)
            escalationTimer = undefined
         }
         destroyStdio()
      }

      child.once('exit', onExit)
      child.kill('SIGTERM')

      if (hasExited()) {
         child.removeListener('exit', onExit)
         destroyStdio()
         return
      }

      // Unref'd on purpose: the live child's own handle keeps the loop open, so
      // this still fires for an agent that ignores SIGTERM, and it cannot hold
      // the CLI open on its own once the child is gone.
      escalationTimer = setTimeout(() => {
         if (!hasExited()) {
            child.kill('SIGKILL')
         }
      }, 3000)
      escalationTimer.unref?.()
   }
}
