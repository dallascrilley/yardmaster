import { afterEach, describe, expect, it } from 'vitest'
import {
  defaultSmokeProviders,
  resolvePiSmokeBackends,
  resolveSmokeProviders,
} from './smoke/support/smoke-providers.js'

describe('smoke-providers', () => {
  const original = process.env.GENIE_SMOKE_PROVIDERS

  afterEach(() => {
    if (original === undefined) {
      delete process.env.GENIE_SMOKE_PROVIDERS
    } else {
      process.env.GENIE_SMOKE_PROVIDERS = original
    }
  })

  it('defaults to all providers when env unset', () => {
    delete process.env.GENIE_SMOKE_PROVIDERS
    expect(resolveSmokeProviders()).toEqual([...defaultSmokeProviders])
  })

  it('defaults when env is only whitespace', () => {
    process.env.GENIE_SMOKE_PROVIDERS = '  '
    expect(resolveSmokeProviders()).toEqual([...defaultSmokeProviders])
  })

  it('parses comma-separated provider ids', () => {
    process.env.GENIE_SMOKE_PROVIDERS = ' gemini , claude '
    expect(resolveSmokeProviders()).toEqual(['gemini', 'claude'])
  })

  it('restricts pi backends to intersection with provider list', () => {
    expect(resolvePiSmokeBackends(['gemini'])).toEqual(['gemini'])
    expect(resolvePiSmokeBackends([...defaultSmokeProviders])).toHaveLength(4)
  })
})
