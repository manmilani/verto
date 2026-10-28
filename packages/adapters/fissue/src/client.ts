import * as path from 'node:path'
import type { VertoConfig } from '@verto/config'
import { FISSUE_API_VERSION, type FissueApiV1, type FissueProjectState } from './system_types.js'
import { requireFissueConfig } from './fissueConfig.js'

/** One fissue project read per instance (DESIGN.md §4.6.10): the `projectState` promise is shared. */
export class FissueClient {
  private memo: { root: string; state: Promise<FissueProjectState> } | undefined

  constructor(
    readonly api: FissueApiV1,
    private readonly workspaceFolder: string,
  ) {
    if (api.apiVersion !== FISSUE_API_VERSION) {
      throw new Error(
        `Verto: fissue API version ${api.apiVersion} is not supported (Verto expects ${FISSUE_API_VERSION}); update ${api.apiVersion > FISSUE_API_VERSION ? 'Verto' : 'the fissue extension'}.`,
      )
    }
  }

  /** The fissue project root: `fissue.root` (default ".") resolved against the workspace folder, then walked up. */
  async root(config: VertoConfig): Promise<string> {
    const start = path.resolve(this.workspaceFolder, requireFissueConfig(config).root ?? '.')
    const root = await this.api.findProjectRoot(start)
    if (!root) throw new Error(`Verto: No fissue project at/above ${start}; run \`fissue init\``)
    return root
  }

  async state(config: VertoConfig): Promise<{ root: string; state: FissueProjectState }> {
    const root = await this.root(config)
    if (this.memo?.root !== root) {
      this.memo = { root, state: this.load(root) }
    }
    return { root, state: await this.memo.state }
  }

  private async load(root: string): Promise<FissueProjectState> {
    const state = await this.api.projectState(root, { bodies: true })
    if (state.tickets.some(t => typeof t.path !== 'string' || typeof t.body !== 'string')) {
      throw new Error('Verto: The fissue extension is too old for Verto (tickets lack paths/bodies); update it.')
    }
    for (const w of state.warnings) {
      console.warn(`[verto] fissue: ${w.file ? `${w.file}: ` : ''}${w.message}`)
    }
    return state
  }
}
