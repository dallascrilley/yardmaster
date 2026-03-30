import { AcpClient, type AcpClientOptions } from './client.js'
import { getAcpProvider } from './provider-registry.js'
import type { ProviderId } from '../types.js'
// Note: This file is a placeholder for future parallel session implementation

export type ParallelSessionConfig = {
  name: string
  provider: ProviderId
  systemPrompt: string
}

export type ParallelSessionResult = {
  name: string
  provider: ProviderId
  status: 'success' | 'error'
  response: string
  latencyMs: number
}

export type ParallelSessionProgress = {
  name: string
  event: 'started' | 'settled'
  result?: ParallelSessionResult
}

async function runSingleSession(
  config: ParallelSessionConfig,
  userPrompt: string,
  options: AcpClientOptions,
): Promise<ParallelSessionResult> {
  const entry = getAcpProvider(config.provider)
  if (!entry) {
    return {
      name: config.name,
      provider: config.provider,
      status: 'error',
      response: `No ACP adapter registered for ${config.provider}`,
      latencyMs: 0,
    }
  }

  const client = new AcpClient(entry, options)
  const startedAt = Date.now()

  try {
    const fullPrompt = `${config.systemPrompt}\n\n${userPrompt}`
    await client.run(fullPrompt)
    
    // Collect response from events - for now return placeholder
    // The actual response would need to be captured via the onEvent callback
    return {
      name: config.name,
      provider: config.provider,
      status: 'success',
      response: '', // Response collected via onEvent
      latencyMs: Date.now() - startedAt,
    }
  } catch (error) {
    return {
      name: config.name,
      provider: config.provider,
      status: 'error',
      response: error instanceof Error ? error.message : String(error),
      latencyMs: Date.now() - startedAt,
    }
  }
}

export async function runParallelAcpSessions(
  configs: ParallelSessionConfig[],
  userPrompt: string,
  options: AcpClientOptions,
  onProgress?: (progress: ParallelSessionProgress) => void,
): Promise<ParallelSessionResult[]> {
  const tasks = configs.map(async (config) => {
    onProgress?.({ name: config.name, event: 'started' })
    
    const result = await runSingleSession(config, userPrompt, options)
    
    onProgress?.({ name: config.name, event: 'settled', result })
    return result
  })

  return Promise.all(tasks)
}
