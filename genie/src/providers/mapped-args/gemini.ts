import { type NormalizedRequest } from '../../types.js'

export function applyGeminiMappedArgs(args: string[], request: NormalizedRequest): void {
  if (request.headless) {
    args.push('--prompt', request.prompt)
  } else {
    args.push(request.prompt)
  }

  if (request.model) {
    args.push('--model', request.model)
  }

  if (request.mode && request.mode !== 'default') {
    args.push('--approval-mode', request.mode)
  }

  if (request.yolo) {
    args.push('--yolo')
  }

  if (request.outputFormat) {
    args.push('--output-format', request.outputFormat)
  }

  if (request.includeDirectories.length > 0) {
    args.push('--include-directories', request.includeDirectories.join(','))
  }

  if (request.extensions.length > 0) {
    args.push('--extensions', request.extensions.join(','))
  }

  if (request.mcp.length > 0) {
    args.push('--allowed-mcp-server-names', request.mcp.join(','))
  }
}
