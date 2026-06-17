import type { DeliveryMapBundle } from '@verto/core'
import type { VertoConfig, DisplayStatusGroup } from '@verto/config'
import { runHostPipeline } from '@verto/text-parser'
import { getAdapter } from './adapterRegistry.js'

export async function runPipeline(
  config: VertoConfig,
  token: string,
  parsedEnabled: boolean,
  priorityOverlay?: Record<string, number | null>,
): Promise<{ bundle: DeliveryMapBundle; displayStatusGroups: DisplayStatusGroup[] }> {
  const adapter = getAdapter(config, token)
  const graph = await adapter.loadProject(config)
  const bundle = runHostPipeline(graph, { parsedEnabled, priorityOverlay })
  const displayStatusGroups = config.ui?.displayStatusGroups ?? []
  return { bundle, displayStatusGroups }
}
