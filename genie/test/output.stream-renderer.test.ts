import { describe, expect, it } from 'vitest'

import { renderEvent } from '../src/output/stream-renderer.js'

describe('renderEvent', () => {
  it('renders content as plain text', () => {
    const result = renderEvent({ kind: 'content', text: 'hello world' }, 'auto', false)
    expect(result).toBe('hello world')
  })

  it('renders tool-call as dim indicator in auto mode (TTY)', () => {
    const result = renderEvent(
      { kind: 'tool-call', name: 'read_file', params: '{}' },
      'auto',
      true,
    )
    expect(result).toBe('\x1b[2m[tool] read_file...\x1b[0m\n')
  })

  it('renders tool-call without ANSI codes when not a TTY', () => {
    const result = renderEvent(
      { kind: 'tool-call', name: 'read_file', params: '{}' },
      'auto',
      false,
    )
    expect(result).toBe('[tool] read_file...\n')
  })

  it('skips tool-result (returns null)', () => {
    const result = renderEvent(
      { kind: 'tool-result', name: 'read_file', result: 'contents' },
      'auto',
      false,
    )
    expect(result).toBeNull()
  })

  it('skips tool-call in plain mode', () => {
    const result = renderEvent(
      { kind: 'tool-call', name: 'read_file', params: '{}' },
      'plain',
      true,
    )
    expect(result).toBeNull()
  })

  it('renders plan as task list', () => {
    const result = renderEvent(
      {
        kind: 'plan',
        entries: [
          { content: 'Read the file', status: 'completed' },
          { content: 'Write the output', status: 'in_progress' },
          { content: 'Clean up', status: 'pending' },
        ],
      },
      'auto',
      false,
    )
    expect(result).toBe('  [done] Read the file\n  [...] Write the output\n  [ ] Clean up\n')
  })

  it('skips plan in plain mode', () => {
    const result = renderEvent(
      {
        kind: 'plan',
        entries: [{ content: 'Do something', status: 'pending' }],
      },
      'plain',
      false,
    )
    expect(result).toBeNull()
  })

  it('returns null for done event', () => {
    const result = renderEvent({ kind: 'done', stopReason: 'end_turn' }, 'auto', false)
    expect(result).toBeNull()
  })
})
