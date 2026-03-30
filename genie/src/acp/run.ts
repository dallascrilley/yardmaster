import type { GenieConfig } from '../config/schema.js'
import type { CliOutputMode } from '../types.js'
import { resolveProviderExecutionPlan } from '../execution/provider-order.js'
import { resolveConfigProviderToken } from '../execution/provider-aliases.js'
import { executeAcpFallback, type AcpFallbackResult } from './fallback.js'
import type { TrustMode } from './host-handlers.js'
import type { StreamEvent } from './types.js'
import { renderEvent } from '../output/stream-renderer.js'

export type RunViaAcpInput = {
  prompt: string
  config: GenieConfig
  provider?: string
  workspace?: string
  trust?: boolean
  yolo?: boolean
  timeoutMs?: number
  noFallback?: boolean
  outputFormat?: CliOutputMode
  mcpServers?: unknown[]
  onEvent?: (event: StreamEvent) => void
}

export async function runViaAcp(input: RunViaAcpInput): Promise<AcpFallbackResult> {
  const {
    prompt,
    config,
    provider: explicitProvider,
    workspace = process.cwd(),
    trust = false,
    yolo = false,
    timeoutMs = config.runtime.timeoutMs,
    noFallback = false,
    outputFormat = 'auto',
    mcpServers,
    onEvent,
  } = input

  const explicitCanonical = explicitProvider
    ? resolveConfigProviderToken(explicitProvider).provider
    : undefined

  const { slots } = resolveProviderExecutionPlan(config, explicitCanonical, noFallback)

  const trustMode: TrustMode = yolo ? 'yolo' : trust ? 'trust' : 'default'
  const isTTY = process.stdout.isTTY ?? false

  const handleEvent = (event: StreamEvent) => {
    onEvent?.(event)
    if (outputFormat !== 'json') {
      const rendered = renderEvent(event, outputFormat, isTTY)
      if (rendered !== null) {
        process.stdout.write(rendered)
      }
    }
  }

  return executeAcpFallback({
    slots,
    prompt,
    workspace,
    trustMode,
    timeoutMs,
    onEvent: handleEvent,
    mcpServers,
  })
}
