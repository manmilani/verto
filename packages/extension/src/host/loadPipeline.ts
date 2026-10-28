import type { DeliveryMapBundle, MissingField } from '@verto/core'
import type { VertoConfig, DisplayStatusGroup, PriorityOptionHints, FieldMappings } from '@verto/config'
import {
  buildPriorityOptionHints,
  buildStatusUniverse,
  shouldShowOthersColumn,
  buildDisplayStatusGroupTooltips,
  withoutMappings,
} from '@verto/config'
import { runHostPipeline } from '@verto/text-parser'
import { getAdapter, type AdapterEnv } from './adapterRegistry.js'

/** One line describing mappings skipped by the field check (DESIGN.md §4.6.4). */
export function formatSkippedFields(skipped: MissingField[]): string {
  const parts = skipped.map(m =>
    `${m.key} (${m.kind} "${m.field}" ${m.reason === 'missing' ? `not found in ${m.scope}` : 'not supported'})`,
  )
  return `Verto: skipped field mappings: ${parts.join('; ')}`
}

export async function runPipeline(
  loadedConfig: VertoConfig,
  env: AdapterEnv,
  parsedEnabled: boolean,
  priorityOverlay?: Record<string, number | null>,
): Promise<{
  bundle: DeliveryMapBundle
  displayStatusGroups: DisplayStatusGroup[]
  showOthersColumn: boolean
  displayStatusGroupTooltips: Record<string, string>
  projectName: string
  priorityOptionHints: PriorityOptionHints
  skipped: MissingField[]
}> {
  const adapter = await getAdapter(loadedConfig, env)
  const skipped = (await adapter.checkFields?.(loadedConfig)) ?? []
  const config = withoutMappings(loadedConfig, skipped.map(m => m.key))

  const fieldMappings = adapter.fieldMappings?.(config) as FieldMappings | undefined
  const [graph, projectName, auditedTicketStatuses] = await Promise.all([
    adapter.loadProject(config),
    adapter.projectTitle?.(config) ?? Promise.resolve(config.adapter),
    adapter.fetchStatusOptions?.(config) ?? Promise.resolve([]),
  ])
  const bundle = runHostPipeline(graph, { parsedEnabled, priorityOverlay, fieldMappings })
  const displayStatusGroups = config.ui?.displayStatusGroups ?? []
  const statusUniverse = buildStatusUniverse(bundle.graph.nodes, auditedTicketStatuses)
  const showOthersColumn = shouldShowOthersColumn(
    displayStatusGroups,
    statusUniverse,
    fieldMappings,
  )
  const priorityOptionHints = buildPriorityOptionHints(fieldMappings?.priority)
  const displayStatusGroupTooltips = buildDisplayStatusGroupTooltips(
    displayStatusGroups,
    statusUniverse,
    fieldMappings,
    showOthersColumn,
  )
  return {
    bundle,
    displayStatusGroups,
    showOthersColumn,
    displayStatusGroupTooltips,
    projectName,
    priorityOptionHints,
    skipped,
  }
}
