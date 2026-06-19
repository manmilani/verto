import type { DeliveryMapBundle } from '@verto/core'
import type { VertoConfig, DisplayStatusGroup, PriorityOptionHints } from '@verto/config'
import {
  buildPriorityOptionHints,
  buildStatusUniverse,
  shouldShowOthersColumn,
  buildDisplayStatusGroupTooltips,
} from '@verto/config'
import { fetchProjectStatusOptions } from '@verto/adapter-github'
import { runHostPipeline } from '@verto/text-parser'
import { getAdapter } from './adapterRegistry.js'
import { resolveProjectTitle } from './resolveProjectTitle.js'

export async function runPipeline(
  config: VertoConfig,
  token: string,
  parsedEnabled: boolean,
  priorityOverlay?: Record<string, number | null>,
): Promise<{
  bundle: DeliveryMapBundle
  displayStatusGroups: DisplayStatusGroup[]
  showOthersColumn: boolean
  displayStatusGroupTooltips: Record<string, string>
  projectName: string
  priorityOptionHints: PriorityOptionHints
}> {
  const adapter = getAdapter(config, token)
  const [graph, projectName, auditedTicketStatuses] = await Promise.all([
    adapter.loadProject(config),
    resolveProjectTitle(config, token),
    fetchProjectStatusOptions(token, config),
  ])
  const bundle = runHostPipeline(graph, { parsedEnabled, priorityOverlay })
  const displayStatusGroups = config.ui?.displayStatusGroups ?? []
  const statusUniverse = buildStatusUniverse(bundle.graph.nodes, auditedTicketStatuses)
  const showOthersColumn = shouldShowOthersColumn(
    displayStatusGroups,
    statusUniverse,
    config.github?.fieldMappings,
  )
  const priorityOptionHints = buildPriorityOptionHints(config.github?.fieldMappings?.priority)
  const displayStatusGroupTooltips = buildDisplayStatusGroupTooltips(
    displayStatusGroups,
    statusUniverse,
    config.github?.fieldMappings,
    showOthersColumn,
  )
  return {
    bundle,
    displayStatusGroups,
    showOthersColumn,
    displayStatusGroupTooltips,
    projectName,
    priorityOptionHints,
  }
}
