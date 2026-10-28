import * as path from 'node:path'
import type { MissingField, VertoAdapter, VertoGraph } from '@verto/core'
import { validateVertoConfig } from '@verto/config'
import type { VertoConfig } from '@verto/config'
import { FissueClient } from './client.js'
import { checkFieldsAgainst } from './fields.js'
import { requireFissueConfig } from './fissueConfig.js'
import { mapTicketsToGraph } from './mapper.js'
import type { FissueApiV1 } from './system_types.js'

/** Read-only fissue adapter (DESIGN.md §4.6.10). Create one per load: it reads the project once. */
export class FissueAdapter implements VertoAdapter<VertoConfig> {
  private readonly client: FissueClient

  constructor(api: FissueApiV1, workspaceFolder: string) {
    this.client = new FissueClient(api, workspaceFolder)
  }

  fieldMappings(config: VertoConfig): Record<string, unknown> | undefined {
    return requireFissueConfig(config).fieldMappings as Record<string, unknown> | undefined
  }

  async checkFields(config: VertoConfig): Promise<MissingField[]> {
    const { root, state } = await this.client.state(config)
    return checkFieldsAgainst(
      requireFissueConfig(config).fieldMappings ?? {},
      state.config,
      path.join(root, '.fissue', 'config.json'),
    )
  }

  /** Option names of the select field `status` maps to (for display status groups). */
  async fetchStatusOptions(config: VertoConfig): Promise<string[]> {
    const entry = requireFissueConfig(config).fieldMappings?.['status']
    if (!entry || entry.from.field.includes('.')) return []
    const { state } = await this.client.state(config)
    const def = state.config.fields[entry.from.field]
    return def?.type === 'select' ? (def.options ?? []).map(o => o.name) : []
  }

  async projectTitle(config: VertoConfig): Promise<string> {
    return `fissue: ${path.basename(await this.client.root(config))}`
  }

  async loadProject(config: VertoConfig): Promise<VertoGraph> {
    validateVertoConfig(config)
    const { state } = await this.client.state(config)
    return mapTicketsToGraph(state, config)
  }
}
