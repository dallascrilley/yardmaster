import { type NormalizedRequest } from '../types.js'

function pushRepeatable(args: string[], flag: string, values: string[]) {
  for (const value of values) {
    args.push(flag, value)
  }
}

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
