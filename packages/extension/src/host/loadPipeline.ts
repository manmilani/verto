import type { DeliveryMapBundle } from '@verto/core'
import type { VertoConfig, DisplayStatusGroup, PriorityOptionHints } from '@verto/config'
import { buildPriorityOptionHints } from '@verto/config'
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
  projectName: string
  priorityOptionHints: PriorityOptionHints
}> {
  const adapter = getAdapter(config, token)
  const [graph, projectName] = await Promise.all([
    adapter.loadProject(config),
    resolveProjectTitle(config, token),
  ])
  const bundle = runHostPipeline(graph, { parsedEnabled, priorityOverlay })
  const displayStatusGroups = config.ui?.displayStatusGroups ?? []
  const priorityOptionHints = buildPriorityOptionHints(config.github?.fieldMappings?.priority)
  return { bundle, displayStatusGroups, projectName, priorityOptionHints }
}
