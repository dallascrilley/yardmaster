import type { ProviderExecutionSlot } from '../execution/provider-order.js'
import type { ProviderId, ProviderFailureReason } from '../types.js'
import { ACP_AUTH_ERROR_CODE, AggregatedProviderError, AcpProtocolError, TimeoutError } from '../errors.js'
import { formatAcpFailureForUi } from './normalize-sdk-rejection.js'
import { AcpClient, type AcpClientOptions } from './client.js'
import { getAcpProvider } from './provider-registry.js'
import type { TrustMode } from './host-handlers.js'
import type { StreamEvent } from './types.js'

export type AcpFallbackParams = {
   slots: ProviderExecutionSlot[]
   prompt: string
   workspace: string
   trustMode: TrustMode
   timeoutMs: number
   onEvent: (event: StreamEvent) => void
   mcpServers?: unknown[]
   existingSessionId?: string
   model?: string
}

export type AcpFallbackResult = {
   provider: ProviderId
   stopReason: string
   sessionId?: string
   response: string
}

export async function executeAcpFallback(params: AcpFallbackParams): Promise<AcpFallbackResult> {
   const { slots, prompt, workspace, trustMode, timeoutMs, onEvent, mcpServers, existingSessionId, model } = params
   const failures: ProviderFailureReason[] = []

   for (const slot of slots) {
      const entry = getAcpProvider(slot.provider)
      if (!entry) {
         failures.push({
            provider: slot.provider,
            stage: 'availability',
            reason: `No ACP adapter registered for ${slot.provider}`,
         })
         continue
      }

      if (entry.authCheck) {
         const ok = await entry.authCheck().catch(() => false)
         if (!ok) {
            failures.push({
               provider: slot.provider,
               stage: 'auth',
               reason: `Auth check failed for ${slot.provider}`,
               authFailure: true,
            })
            continue
         }
      }

      const effectiveModel = model ?? slot.aliasModel
      const options: AcpClientOptions = {
         workspace,
         trustMode,
         timeoutMs,
         onEvent,
         mcpServers,
         model: effectiveModel,
      }
      let response = ''
      const collectEvent = (event: StreamEvent) => {
         if (event.kind === 'content') {
            response += event.text
         }
         onEvent(event)
      }
      const client = new AcpClient(entry, { ...options, onEvent: collectEvent })

      try {
         let stopReason: string

         if (existingSessionId) {
            // Try to resume existing session
            const resumed = await client.resume(existingSessionId)
            if (resumed) {
               // Session resumed successfully - send prompt
               stopReason = await client.prompt(prompt)
               client.close()
            } else {
               // Resume failed, create new session with full lifecycle
               stopReason = await client.run(prompt)
            }
         } else {
            stopReason = await client.run(prompt)
         }

         return {
            provider: slot.provider,
            stopReason,
            sessionId: client.getSessionId() ?? undefined,
            response: response.trim(),
         }
      } catch (err) {
         const isAuthError = err instanceof AcpProtocolError && err.code === ACP_AUTH_ERROR_CODE
         const stage = isAuthError ? 'auth' : 'execution'
         failures.push({
            provider: slot.provider,
            stage,
            reason: formatAcpFailureForUi(err),
            authFailure: isAuthError,
            timeout: err instanceof TimeoutError,
         })
      } finally {
         client.close()
      }
   }

   throw new AggregatedProviderError(failures)
}
