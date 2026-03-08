import { type NormalizedRequest } from '../../types.js'

export function applyCursorMappedArgs(args: string[], request: NormalizedRequest): void {
  if (request.model) {
    args.push('--model', request.model)
  }

  if (request.mode && request.mode !== 'default') {
    args.push('--mode', request.mode)
  }

  if (request.trust) {
    args.push('--trust')
  }

  if (request.yolo) {
    args.push('--yolo')
  }

  if (request.headless) {
    args.push('--print')
    args.push('--output-format', request.outputFormat)
  }

  if (request.mcp.length > 0) {
    args.push('--approve-mcps')
  }
}
