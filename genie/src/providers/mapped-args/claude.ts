import { type NormalizedRequest } from '../../types.js'
import { pushRepeatable } from './shared.js'

export function applyClaudeMappedArgs(args: string[], request: NormalizedRequest): void {
  if (request.model) {
    args.push('--model', request.model)
  }

  if (request.mode && request.mode !== 'default') {
    args.push('--permission-mode', request.mode)
  }

  if (request.headless) {
    args.push('--print')
    if (request.outputFormat) {
      args.push('--output-format', request.outputFormat)
    }
  }

  pushRepeatable(args, '--add-dir', request.includeDirectories)
  pushRepeatable(args, '--mcp-config', request.mcp)
}
