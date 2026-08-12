import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import type {
  Client,
  ReadTextFileRequest,
  ReadTextFileResponse,
  WriteTextFileRequest,
  WriteTextFileResponse,
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionNotification,
  CreateTerminalRequest,
  CreateTerminalResponse,
  TerminalOutputRequest,
  TerminalOutputResponse,
  ReleaseTerminalRequest,
  ReleaseTerminalResponse,
} from '@agentclientprotocol/sdk'
import type { StreamEvent, PlanEntry } from './types.js'

export type TrustMode = 'default' | 'trust' | 'yolo'

export type YardmasterClientOptions = {
  readonly workspace: string
  readonly trustMode: TrustMode
  readonly onEvent: (event: StreamEvent) => void
}

type TerminalState = {
  readonly output: string
  readonly truncated: boolean
  readonly exitCode: number | null
  readonly exited: boolean
  readonly kill: () => void
}

function isWithinWorkspace(filePath: string, workspace: string): boolean {
  const resolved = resolve(filePath)
  const resolvedWorkspace = resolve(workspace)
  return resolved === resolvedWorkspace || resolved.startsWith(resolvedWorkspace + '/')
}

function mapPlanEntries(
  entries: ReadonlyArray<{
    content: string
    status: string
    priority: string
  }>,
): readonly PlanEntry[] {
  return entries.map((e) => ({
    content: e.content,
    status: (e.status === 'pending' || e.status === 'in_progress' || e.status === 'completed'
      ? e.status
      : 'pending') as PlanEntry['status'],
    priority: (e.priority === 'high' || e.priority === 'medium' || e.priority === 'low'
      ? e.priority
      : undefined) as PlanEntry['priority'],
  }))
}

export function createYardmasterClient(options: YardmasterClientOptions): Client {
  const { workspace, trustMode, onEvent } = options
  const terminals = new Map<string, TerminalState>()

  const readTextFile = async (params: ReadTextFileRequest): Promise<ReadTextFileResponse> => {
    const raw = await readFile(params.path, 'utf-8')
    const lines = raw.split('\n')

    const startLine = params.line != null ? Math.max(1, params.line) : 1
    const startIdx = startLine - 1
    const slice =
      params.limit != null
        ? lines.slice(startIdx, startIdx + params.limit)
        : lines.slice(startIdx)

    return { content: slice.join('\n') }
  }

  const writeTextFile = async (params: WriteTextFileRequest): Promise<WriteTextFileResponse> => {
    const withinWorkspace = isWithinWorkspace(params.path, workspace)
    const allowed =
      trustMode === 'yolo' || (trustMode === 'trust' && withinWorkspace)

    if (!allowed) {
      throw new Error(
        `Write denied: trustMode="${trustMode}" and path "${params.path}" is outside workspace or permission not granted`,
      )
    }

    const resolvedPath = resolve(params.path)
    await mkdir(dirname(resolvedPath), { recursive: true })
    await writeFile(resolvedPath, params.content, 'utf-8')
    return {}
  }

  const requestPermission = async (
    params: RequestPermissionRequest,
  ): Promise<RequestPermissionResponse> => {
    if (trustMode === 'yolo') {
      const first = params.options[0]
      if (first == null) {
        return { outcome: { outcome: 'cancelled' } }
      }
      return { outcome: { outcome: 'selected', optionId: first.optionId } }
    }

    if (trustMode === 'trust') {
      const allowOption = params.options.find(
        (o) => o.kind === 'allow_once' || o.kind === 'allow_always',
      )
      if (allowOption != null) {
        return { outcome: { outcome: 'selected', optionId: allowOption.optionId } }
      }
      const first = params.options[0]
      if (first == null) {
        return { outcome: { outcome: 'cancelled' } }
      }
      return { outcome: { outcome: 'selected', optionId: first.optionId } }
    }

    // default mode: deny
    return { outcome: { outcome: 'cancelled' } }
  }

  const sessionUpdate = async (params: SessionNotification): Promise<void> => {
    const update = params.update

    switch (update.sessionUpdate) {
      case 'agent_message_chunk':
      case 'user_message_chunk':
      case 'agent_thought_chunk': {
        const block = update.content
        if (block.type === 'text') {
          onEvent({ kind: 'content', text: block.text })
        }
        break
      }
      case 'tool_call': {
        onEvent({
          kind: 'tool-call',
          name: update.title ?? update.toolCallId ?? 'unknown',
          params: JSON.stringify(update.rawInput ?? {}),
        })
        break
      }
      case 'tool_call_update': {
        if (update.status === 'completed' || update.status === 'failed') {
          onEvent({
            kind: 'tool-result',
            name: update.title ?? update.toolCallId ?? 'unknown',
            result: JSON.stringify(update.rawOutput ?? {}),
          })
        }
        break
      }
      case 'plan': {
        onEvent({
          kind: 'plan',
          entries: mapPlanEntries(update.entries),
        })
        break
      }
      default:
        break
    }
  }

  const createTerminal = async (params: CreateTerminalRequest): Promise<CreateTerminalResponse> => {
    const terminalId = randomUUID()
    const byteLimit = params.outputByteLimit ?? 1_000_000

    let outputBuf = ''
    let truncated = false
    let exitCode: number | null = null
    let exited = false

    const env = { ...process.env } as Record<string, string>
    if (params.env != null) {
      for (const pair of params.env) {
        env[pair.name] = pair.value
      }
    }

    const child = spawn(params.command, params.args ?? [], {
      cwd: params.cwd ?? workspace,
      env,
      shell: false,
    })

    function appendOutput(chunk: string): void {
      if (truncated) return
      const combined = outputBuf + chunk
      const bytes = Buffer.byteLength(combined, 'utf-8')
      if (bytes > byteLimit) {
        const excess = bytes - byteLimit
        // trim from the beginning to stay within limit, respecting utf-8 boundaries
        const buf = Buffer.from(combined, 'utf-8')
        outputBuf = buf.slice(excess).toString('utf-8')
        truncated = true
      } else {
        outputBuf = combined
      }
    }

    child.stdout?.on('data', (chunk: Buffer) => {
      appendOutput(chunk.toString('utf-8'))
    })

    child.stderr?.on('data', (chunk: Buffer) => {
      appendOutput(chunk.toString('utf-8'))
    })

    child.on('exit', (code) => {
      exitCode = code
      exited = true
    })

    const kill = (): void => {
      if (!exited) child.kill()
    }

    const state: TerminalState = {
      get output() {
        return outputBuf
      },
      get truncated() {
        return truncated
      },
      get exitCode() {
        return exitCode
      },
      get exited() {
        return exited
      },
      kill,
    }

    terminals.set(terminalId, state)
    return { terminalId }
  }

  const terminalOutput = async (params: TerminalOutputRequest): Promise<TerminalOutputResponse> => {
    const state = terminals.get(params.terminalId)
    if (state == null) {
      throw new Error(`Terminal not found: ${params.terminalId}`)
    }

    return {
      output: state.output,
      truncated: state.truncated,
      exitStatus: state.exited
        ? { exitCode: state.exitCode }
        : undefined,
    }
  }

  const releaseTerminal = async (params: ReleaseTerminalRequest): Promise<ReleaseTerminalResponse> => {
    const state = terminals.get(params.terminalId)
    if (state != null) {
      state.kill()
      terminals.delete(params.terminalId)
    }
    return {}
  }

  return {
    requestPermission,
    sessionUpdate,
    readTextFile,
    writeTextFile,
    createTerminal,
    terminalOutput,
    releaseTerminal,
  }
}
