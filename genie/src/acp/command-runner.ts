import type { GenieConfig } from '../config/schema.js'
import { resolveProviderExecutionPlan } from '../execution/provider-order.js'
import { resolveConfigProviderToken } from '../execution/provider-aliases.js'
import { executeAcpFallback } from './fallback.js'
import type { TrustMode } from './host-handlers.js'
import type { StreamEvent } from './types.js'

export type AcpCommandInput = {
  systemPrompt?: string
  userPrompt: string
  provider?: string
  model?: string
  workspace: string
  trustMode: TrustMode
  timeoutMs: number
  config: GenieConfig
  noFallback?: boolean
}

export async function runAcpCommand(input: AcpCommandInput): Promise<string> {
  const {
    systemPrompt,
    userPrompt,
    provider: explicitProvider,
    model,
    workspace,
    trustMode,
    timeoutMs,
    config,
    noFallback = false,
  } = input

  const explicitCanonical = explicitProvider
    ? resolveConfigProviderToken(explicitProvider).provider
    : undefined

  const { slots } = resolveProviderExecutionPlan(config, explicitCanonical, noFallback)

  // Combine system prompt with user prompt if provided
  const fullPrompt = systemPrompt
    ? `${systemPrompt}\n\n${userPrompt}`
    : userPrompt

  let responseText = ''
  const onEvent = (event: StreamEvent) => {
    if (event.kind === 'content') {
      responseText += event.text
    }
  }

  await executeAcpFallback({
    slots,
    prompt: fullPrompt,
    workspace,
    trustMode,
    timeoutMs,
    onEvent,
    model,
  })

  return responseText.trim()
}
