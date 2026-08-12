import type { HelpTopic } from './types.js'
import { buildRootHelp } from './help/root.js'
import {
  commitHelp,
  completionHelp,
  configHelp,
  debugHelp,
  designHelp,
  presetsHelp,
  providersHelp,
  reviewHelp,
  runHelp,
  updateHelp,
} from './help/topics.js'

export function usage(topic?: HelpTopic): string {
  if (topic === 'run') return runHelp.join('\n')
  if (topic === 'design') return designHelp.join('\n')
  if (topic === 'commit') return commitHelp.join('\n')
  if (topic === 'debug') return debugHelp.join('\n')
  if (topic === 'review') return reviewHelp.join('\n')
  if (topic === 'update') return updateHelp.join('\n')
  if (topic === 'providers') return providersHelp.join('\n')
  if (topic === 'config') return configHelp.join('\n')
  if (topic === 'presets') return presetsHelp.join('\n')
  if (topic === 'completion') return completionHelp.join('\n')
  return buildRootHelp()
}
