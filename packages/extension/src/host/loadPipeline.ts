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

/** One field-check finding, with the other kinds where the name exists (DESIGN.md §4.6.4). */
export function describeMissingField(m: MissingField): string {
  const problem = m.reason === 'missing' ? `not found in ${m.scope}` : 'not supported'
  const hint = m.suggestedKinds.length > 0
    ? ` — found as kind ${m.suggestedKinds.map(k => `"${k}"`).join(', ')}`
    : ''
  return `${m.key}: kind "${m.kind}" "${m.field}" ${problem}${hint}`
}

/** One line describing mappings skipped by the field check (scripts). */
export function formatSkippedFields(skipped: MissingField[]): string {
  return `Verto: skipped field mappings: ${skipped.map(describeMissingField).join('; ')}`
}

/**
 * Check, then load. When the field check finds mappings that can't be read, `confirmSkip`
 * decides: `true` skips them and loads, `false` cancels (result `null`). Without it they are
 * skipped (non-interactive scripts).
 */
export async function runPipeline(
  loadedConfig: VertoConfig,
  env: AdapterEnv,
  parsedEnabled: boolean,
  priorityOverlay?: Record<string, number | null>,
  confirmSkip?: (missing: MissingField[]) => Promise<boolean>,
): Promise<{
  bundle: DeliveryMapBundle
  displayStatusGroups: DisplayStatusGroup[]
  showOthersColumn: boolean
  displayStatusGroupTooltips: Record<string, string>
  projectName: string
  priorityOptionHints: PriorityOptionHints
  skipped: MissingField[]
} | null> {
  const adapter = await getAdapter(loadedConfig, env)
  const skipped = (await adapter.checkFields?.(loadedConfig)) ?? []
  if (skipped.length > 0 && confirmSkip && !(await confirmSkip(skipped))) return null
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
