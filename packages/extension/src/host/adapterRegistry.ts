import type { VertoAdapter } from '@verto/core'
import type { VertoConfig } from '@verto/config'
import { isWorkspaceSetupComplete } from '@verto/config'
import { GitHubAdapter, githubAdapterDefaults } from '@verto/adapter-github'
import { FissueAdapter, fissueAdapterDefaults, type FissueApiV1 } from '@verto/adapter-fissue'

/** Host services an adapter may need; each is called only by the adapter that uses it. No `vscode` here. */
export interface AdapterEnv {
  workspaceFolder: string
  /** Resolves to a token, or throws (e.g. when the user declines sign-in). */
  getGitHubToken(): Promise<string>
  getFissueApi(): Promise<FissueApiV1>
}

export interface AdapterEntry {
  defaults: VertoConfig
  create(env: AdapterEnv): Promise<VertoAdapter<VertoConfig>>
  /** Adapters with a setup wizard define when the workspace file is complete (DESIGN.md §4.6.9). */
  setup?: { isComplete(raw: Record<string, unknown>): boolean }
}

export const ADAPTERS: Record<string, AdapterEntry> = {
  github: {
    defaults: githubAdapterDefaults,
    create: async env => new GitHubAdapter(await env.getGitHubToken()),
    setup: { isComplete: isWorkspaceSetupComplete },
  },
  fissue: {
    defaults: fissueAdapterDefaults,
    create: async env => new FissueAdapter(await env.getFissueApi(), env.workspaceFolder),
  },
}

/** The registry entry for an adapter id, or undefined. */
export function findAdapter(id: unknown): AdapterEntry | undefined {
  return typeof id === 'string' && Object.hasOwn(ADAPTERS, id) ? ADAPTERS[id] : undefined
}

export async function getAdapter(config: VertoConfig, env: AdapterEnv): Promise<VertoAdapter<VertoConfig>> {
  const entry = findAdapter(config.adapter)
  if (!entry) throw new Error(`Verto: Unknown adapter "${config.adapter}"`)
  return entry.create(env)
}
