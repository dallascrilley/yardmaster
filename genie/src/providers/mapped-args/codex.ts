import { type NormalizedRequest } from '../../types.js'
import { pushRepeatable } from './shared.js'

export function applyCodexMappedArgs(args: string[], request: NormalizedRequest): void {
  if (request.model) {
    args.push('--model', request.model)
  }

  pushRepeatable(args, '--add-dir', request.includeDirectories)
  if (request.outputFormat === 'json' || request.outputFormat === 'stream-json') {
    args.push('--json')
  }

  if (request.yolo || request.trust) {
    args.push('--dangerously-bypass-approvals-and-sandbox')
  }
}
