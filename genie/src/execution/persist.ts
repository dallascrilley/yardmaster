import { defaultConfig } from '../config/schema.js'
import { updateConfig } from '../config/store.js'
import { type GenieRunResult, type NormalizedRequest } from '../types.js'

export async function persistLastUsedConfig(params: {
  request: NormalizedRequest
  providerId: GenieRunResult['provider']
}): Promise<void> {
  const { request, providerId } = params

  await updateConfig((current) => {
    const byProvider = {
      ...current.model.byProvider,
      ...(request.model && { [providerId]: request.model }),
    }

    return {
      provider: {
        ...current.provider,
        default: providerId,
      },
      model: {
        byProvider,
      },
      mode: {
        default: request.mode,
      },
      workspace: {
        last: request.workspace,
      },
      output: {
        default: request.output,
      },
      trust: {
        default: request.trust,
      },
      runtime: {
        timeoutMs: request.timeoutMs,
      },
      presets: current.presets,
      _meta: current._meta,
    }
  })
}

export function resolveResultModel(params: {
  request: NormalizedRequest
  providerId: GenieRunResult['provider']
}): string | undefined {
  return params.request.model ?? defaultConfig.model.byProvider[params.providerId]
}
