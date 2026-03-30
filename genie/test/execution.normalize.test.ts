import { describe, expect, it } from 'vitest'

import { defaultConfig, mergeConfig } from '../src/config/schema.js'
import { UsageError } from '../src/errors.js'
import {
  normalizeRequest,
  resolveProviderExecutionPlan,
  resolveProviderOrder,
} from '../src/execution/normalize.js'

const withHistory = {
  ...defaultConfig,
  workspace: {
    last: '/tmp/last-workspace',
  },
}

describe('request normalization', () => {
  it('applies defaults from config', () => {
    const request = normalizeRequest({ prompt: '  hello there  ' }, withHistory)
    expect(request.prompt).toBe('hello there')
    expect(request.workspace).toBe('/tmp/last-workspace')
    expect(request.mode).toBe('default')
    expect(request.output).toBe('auto')
    expect(request.headless).toBe(true)
    expect(request.outputFormat).toBe('text')
    expect(request.yolo).toBe(false)
    expect(request.includeDirectories).toEqual([])
  })

  it('resolves explicit and fallback provider order', () => {
    const explicit = resolveProviderOrder(withHistory, 'codex')
    const implicit = resolveProviderOrder(withHistory)

    expect(explicit.order[0]).toBe('codex')
    expect(implicit.order[0]).toBe('claude')
    expect(explicit.explicitUsed).toBe(true)
    expect(implicit.explicitUsed).toBe(false)
  })

  it('throws when explicit provider order input is invalid', () => {
    expect(() => resolveProviderOrder(withHistory, 'not-a-provider')).toThrow(UsageError)
  })

  it('throws when provider is invalid', () => {
    expect(() => {
      normalizeRequest({ prompt: 'x', provider: 'invalid' }, withHistory)
    }).toThrow()
  })

  it('dedupes pi and gemini into a single gemini execution slot', () => {
    const withPi = mergeConfig(defaultConfig, {
      provider: {
        default: 'pi',
        fallbackOrder: ['gemini', 'claude', 'codex', 'cursor-agent'],
      },
    })
    const { slots } = resolveProviderExecutionPlan(withPi, undefined, false)
    expect(slots.map((s) => s.provider)).toEqual(['gemini', 'claude', 'codex', 'cursor-agent'])
    expect(slots.filter((s) => s.provider === 'gemini')).toHaveLength(1)
  })

  it('accepts pi as explicit provider token in resolveProviderOrder', () => {
    const { order } = resolveProviderOrder(withHistory, 'pi')
    expect(order[0]).toBe('gemini')
    expect(order.filter((id) => id === 'gemini')).toHaveLength(1)
  })
})
