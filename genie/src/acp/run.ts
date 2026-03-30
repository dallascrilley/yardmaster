import type { GenieConfig } from '../config/schema.js'
import type { CliOutputMode } from '../types.js'
import { resolveProviderExecutionPlan } from '../execution/provider-order.js'
import { resolveConfigProviderToken } from '../execution/provider-aliases.js'
import { executeAcpFallback, type AcpFallbackResult } from './fallback.js'
import type { TrustMode } from './host-handlers.js'
import type { StreamEvent } from './types.js'
import { renderEvent } from '../output/stream-renderer.js'
import { loadSession, saveSession } from './session-store.js'
import { getAcpProvider } from './provider-registry.js'
import { persistLastUsedConfig } from '../execution/persist.js'
import { defaultConfig } from '../config/schema.js'

export type RunViaAcpInput = {
  prompt: string
  config: GenieConfig
  provider?: string
  model?: string
  workspace?: string
  trust?: boolean
  yolo?: boolean
  timeoutMs?: number
  noFallback?: boolean
  outputFormat?: CliOutputMode
  mcpServers?: unknown[]
  onEvent?: (event: StreamEvent) => void
  session?: string
}

export type RunViaAcpResult = AcpFallbackResult & {
  fallbackUsed: boolean
  model: string | null
  timings: {
    totalMs: number
    attempts: Array<{
      provider: AcpFallbackResult['provider']
      stage: 'success'
      durationMs: number
      ok: true
    }>
  }
}

export async function runViaAcp(input: RunViaAcpInput): Promise<RunViaAcpResult> {
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
    session: sessionName,
    model,
  } = input

  const explicitCanonical = explicitProvider
    ? resolveConfigProviderToken(explicitProvider).provider
    : undefined

  const { slots } = resolveProviderExecutionPlan(config, explicitCanonical, noFallback)
  const startedAt = Date.now()

  const trustMode: TrustMode = yolo ? 'yolo' : trust ? 'trust' : 'default'
  const isTTY = process.stdout.isTTY ?? false

  // Load existing session if name provided
  let existingSessionId: string | undefined
  if (sessionName) {
    const persisted = await loadSession(sessionName)
    if (persisted) {
      existingSessionId = persisted.sessionId
    }
  }

  const handleEvent = (event: StreamEvent) => {
    onEvent?.(event)
    if (outputFormat !== 'json') {
      const rendered = renderEvent(event, outputFormat, isTTY)
      if (rendered !== null) {
        process.stdout.write(rendered)
      }
    }
  }

  const result = await executeAcpFallback({
    slots,
    prompt,
    workspace,
    trustMode,
    timeoutMs,
    onEvent: handleEvent,
    mcpServers,
    existingSessionId,
    model,
  })

  const totalMs = Date.now() - startedAt

  try {
    await persistLastUsedConfig({
      request: {
        prompt,
        provider: result.provider,
        model: model ?? config.model.byProvider[result.provider],
        workspace,
        mode: config.mode.default,
        trust: trustMode !== 'default',
        output: outputFormat,
        timeoutMs,
        noFallback,
        yolo,
        includeDirectories: [],
        outputFormat: 'text',
        headless: false,
        extensions: [],
        mcp: [],
      },
      providerId: result.provider,
    })
  } catch {
    process.stderr.write('Warning: failed to persist last-used config\n')
  }

  // Save session if name provided
  if (sessionName && result.sessionId) {
    const entry = getAcpProvider(result.provider)
    if (entry) {
      await saveSession(sessionName, {
        sessionId: result.sessionId,
        agentCommand: entry.agentCommand,
        args: entry.args,
        cwd: workspace,
        provider: result.provider,
      })
    }
  }

  return {
    ...result,
    fallbackUsed: slots[0]?.provider !== result.provider,
    model: model ?? config.model.byProvider[result.provider] ?? defaultConfig.model.byProvider[result.provider] ?? null,
    timings: {
      totalMs,
      attempts: [
        {
          provider: result.provider,
          stage: 'success',
          durationMs: totalMs,
          ok: true,
        },
      ],
    },
  }
}
