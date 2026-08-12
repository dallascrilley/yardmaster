import { isStrictCommandsEnabled } from '../validate.js'
import {
  aliasCommands,
  defaultGlobals,
  looksLikeMistypedRootCommand,
  parseGlobalFlag,
  rootCommands,
  shouldPreservePromptShorthand,
  strictCommandNames,
} from './shared.js'
import {
  parseCommitArgs,
  parseDebugArgs,
  parseDesignArgs,
  parseRunLikeArgs,
} from './prompt-commands.js'
import {
  parseCompletionArgs,
  parseConfigArgs,
  parsePresetsArgs,
  parseProvidersArgs,
  parseReviewArgs,
  parseUpdateArgs,
} from './state-commands.js'

export {
  aliasCommands,
  defaultGlobals,
  isStrictCommandsEnabled,
  looksLikeMistypedRootCommand,
  parseCommitArgs,
  parseCompletionArgs,
  parseConfigArgs,
  parseDebugArgs,
  parseDesignArgs,
  parseGlobalFlag,
  parsePresetsArgs,
  parseProvidersArgs,
  parseReviewArgs,
  parseRunLikeArgs,
  parseUpdateArgs,
  rootCommands,
  shouldPreservePromptShorthand,
  strictCommandNames,
}
