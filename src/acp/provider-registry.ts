import { constants as fsConstants } from 'node:fs'
import { accessSync } from 'node:fs'
import { delimiter, join } from 'node:path'
import type { ProviderId } from '../types.js'
import type { AcpProviderEntry } from './types.js'

/** Environment variable names for model selection per provider. */
export const modelEnvVars: Record<ProviderId, string> = {
   claude: 'ANTHROPIC_MODEL',
   codex: 'OPENAI_MODEL',
   gemini: 'GEMINI_MODEL',
   'cursor-agent': 'CURSOR_MODEL',
}

type StableLauncher = {
   agentCommand: string
   args?: readonly string[]
}

function isExecutable(path: string): boolean {
   try {
      accessSync(path, fsConstants.X_OK)
      return true
   } catch {
      return false
   }
}

function resolveBinaryFromPath(binaryName: string): string | undefined {
   const searchPath = process.env.PATH
   if (!searchPath) return undefined

   for (const dir of searchPath.split(delimiter)) {
      if (!dir) continue
      const candidate = join(dir, binaryName)
      if (isExecutable(candidate)) {
         return candidate
      }
   }

   return undefined
}

/**
 * Cursor CLI binary used for ACP (`agent acp`) and for `yardmaster providers doctor` (`agent --version`, `agent status`).
 * Override with **`YARDMASTER_CURSOR_ACP_BIN`** when `agent` is not on `PATH`.
 */
export function resolveCursorCliCommand(): string {
   const envOverride = process.env.YARDMASTER_CURSOR_ACP_BIN?.trim()
   if (envOverride) {
      return envOverride
   }
   const binaryPath = resolveBinaryFromPath('agent')
   if (binaryPath) {
      return binaryPath
   }
   return 'agent'
}

function resolveAcpLauncher(options: {
   envVar: string
   binaryName: string
   packageName: string
}): StableLauncher {
   const envOverride = process.env[options.envVar]?.trim()
   if (envOverride) {
      return { agentCommand: envOverride }
   }

   const binaryPath = resolveBinaryFromPath(options.binaryName)
   if (binaryPath) {
      return { agentCommand: binaryPath }
   }

   return {
      agentCommand: 'npx',
      args: [options.packageName],
   }
}

const registry: ReadonlyMap<ProviderId, AcpProviderEntry> = new Map([
   ['claude', {
      id: 'claude',
      ...resolveAcpLauncher({
         envVar: 'YARDMASTER_CLAUDE_ACP_BIN',
         binaryName: 'claude-agent-acp',
         packageName: '@zed-industries/claude-agent-acp',
      }),
   }],
   ['codex', {
      id: 'codex',
      ...resolveAcpLauncher({
         envVar: 'YARDMASTER_CODEX_ACP_BIN',
         binaryName: 'codex-acp',
         packageName: '@zed-industries/codex-acp',
      }),
   }],
   ['gemini', {
      id: 'gemini',
      agentCommand: 'gemini',
      args: ['--acp'],
      resolveEnv: (): Record<string, string> => {
         const key = process.env.GEMINI_API_KEY?.trim()
         return key ? { GEMINI_API_KEY: key } : {}
      },
      authCheck: async (): Promise<boolean> => Boolean(process.env.GEMINI_API_KEY?.trim()),
   }],
   ['cursor-agent', {
      id: 'cursor-agent',
      agentCommand: resolveCursorCliCommand(),
      args: ['acp'] as const,
      acpAuthenticateMethodId: 'cursor_login',
   }],
])

export function getAcpProvider(id: ProviderId): AcpProviderEntry | undefined {
   return registry.get(id)
}

export function listAcpProviders(): AcpProviderEntry[] {
   return [...registry.values()]
}
