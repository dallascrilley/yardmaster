import type { StreamEvent } from '../acp/types.js'
import type { CliOutputMode } from '../types.js'

const DIM = '\x1b[2m'
const RESET = '\x1b[0m'

const STATUS_ICON: Record<string, string> = {
  completed: '  [done]',
  in_progress: '  [...]',
  pending: '  [ ]',
}

/**
 * Render a StreamEvent to a terminal string.
 * Returns null if the event should be suppressed in the given mode.
 */
export function renderEvent(
  event: StreamEvent,
  mode: CliOutputMode,
  isTTY: boolean,
): string | null {
  switch (event.kind) {
    case 'content':
      return event.text

    case 'tool-call':
      if (mode === 'plain') return null
      return isTTY
        ? `${DIM}[tool] ${event.name}...${RESET}\n`
        : `[tool] ${event.name}...\n`

    case 'tool-result':
      return null

    case 'plan':
      if (mode === 'plain') return null
      return (
        event.entries
          .map((e) => `${STATUS_ICON[e.status] ?? '  '} ${e.content}`)
          .join('\n') + '\n'
      )

    case 'done':
      return null

    default: {
      const _exhaustive: never = event
      void _exhaustive
      return null
    }
  }
}
