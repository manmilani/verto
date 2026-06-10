import type { VertoGraph, DeliveryMapBundle } from './types.js'
import type { GlobalPriorityRankingOptions } from './algorithms/priority.js'
import { leverageScores } from './algorithms/leverage.js'
import { readyNodes } from './algorithms/readiness.js'
import { globalPriorityRanking } from './algorithms/priority.js'
import { implementationOrder } from './algorithms/order.js'
import { deliveryCompleteness } from './algorithms/completeness.js'

/**
 * Runs all @verto/core algorithms over a VertoGraph and assembles the complete
 * DeliveryMapBundle. Every adapter's loadProject() should call this rather than
 * assembling the bundle by hand.
 *
 * The returned bundle is the authoritative, host-computed payload forwarded to
 * the webview via postMessage. The webview does NOT recompute any fields.
 */
export function buildDeliveryMapBundle(
  graph: VertoGraph,
  opts?: GlobalPriorityRankingOptions,
): DeliveryMapBundle {
  const leverage = leverageScores(graph)
  const rankings = globalPriorityRanking(graph, opts)
  const order = implementationOrder(graph, rankings)
  const ready = readyNodes(graph).map(n => n.id)

  const completeness: Record<string, number> = {}
  for (const node of graph.nodes) {
    completeness[node.id] = deliveryCompleteness(graph, node.id)
  }

  return {
    graph,
    implementationOrder: order,
    readyIds: ready,
    leverageScore: leverage,
    globalPriorityRanking: rankings,
    deliveryCompleteness: completeness,
  }
}
