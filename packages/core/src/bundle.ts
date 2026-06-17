import type { VertoGraph, DeliveryMapBundle } from './types.js'
import type { GlobalPriorityRankingOptions } from './algorithms/priority.js'
import { leverageScores } from './algorithms/leverage.js'
import { readyNodes } from './algorithms/readiness.js'
import { globalPriorityRanking } from './algorithms/priority.js'
import { implementationOrder } from './algorithms/order.js'
import { deliveryCompletenessMap } from './algorithms/completeness.js'
import { closureFor } from './algorithms/closure.js'

function buildServedBySliceIds(graph: VertoGraph): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  const nodeById = new Map(graph.nodes.map(n => [n.id, n]))
  for (const node of graph.nodes) {
    if (!node.isDeliverySlice) continue
    for (const memberId of closureFor(graph, node.id, nodeById)) {
      if (!result[memberId]) result[memberId] = []
      result[memberId].push(node.id)
    }
  }
  return result
}

/**
 * Runs all @verto/core algorithms over a VertoGraph and assembles the complete
 * DeliveryMapBundle. Called by runHostPipeline() in @verto/text-parser after
 * graph materialization and validation. Adapters return VertoGraph; the host
 * pipeline owns bundling.
 *
 * The returned bundle is the authoritative, host-computed payload forwarded to
 * the webview via postMessage. The webview does NOT recompute any fields.
 *
 * **Contract:** this function expects a structurally valid graph (no cycles,
 * no dangling refs). Call validateGraph() before this function and handle any
 * errors. If called on an invalid graph, algorithms apply best-effort cycle
 * guards and will return a partial result rather than throwing, but the output
 * may be misleading.
 */
export function buildDeliveryMapBundle(
  graph: VertoGraph,
  opts?: GlobalPriorityRankingOptions,
): DeliveryMapBundle {
  const leverage = leverageScores(graph)
  const rankings = globalPriorityRanking(graph, opts)
  const order = implementationOrder(graph, rankings, leverage) // pass pre-computed leverage
  const ready = readyNodes(graph).map(n => n.id)

  const completeness = deliveryCompletenessMap(graph)

  return {
    graph,
    implementationOrder: order,
    readyIds: ready,
    leverageScore: leverage,
    globalPriorityRanking: rankings,
    deliveryCompleteness: completeness,
    servedBySliceIds: buildServedBySliceIds(graph),
  }
}
