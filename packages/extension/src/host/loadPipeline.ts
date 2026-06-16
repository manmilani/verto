import type { DeliveryMapBundle } from '@verto/core'
import type { VertoConfig, PortfolioColumn } from '@verto/config'
import { runHostPipeline } from '@verto/text-parser'
import { getAdapter } from './adapterRegistry.js'

export async function runPipeline(
  config: VertoConfig,
  token: string,
  parsedEnabled: boolean,
): Promise<{ bundle: DeliveryMapBundle; portfolioColumns: PortfolioColumn[] }> {
  const adapter = getAdapter(config, token)
  const graph = await adapter.loadProject(config)
  const bundle = runHostPipeline(graph, { parsedEnabled })
  const portfolioColumns = config.portfolioColumns ?? []
  return { bundle, portfolioColumns }
}
