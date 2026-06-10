import type { VertoGraph } from '../types.js'
import { closureFor } from './closure.js'

/**
 * Returns the delivery completeness for nodeId: the fraction of nodes in its
 * transitive prerequisite closure (including nodeId itself) that are isDone.
 * Returns 0 for an empty closure (should not happen — closure always includes
 * the node itself).
 */
export function deliveryCompleteness(graph: VertoGraph, nodeId: string): number {
  const closure = closureFor(graph, nodeId)
  if (closure.size === 0) return 0

  const nodeById = new Map(graph.nodes.map(n => [n.id, n]))
  let doneCount = 0
  for (const id of closure) {
    if (nodeById.get(id)?.isDone) doneCount++
  }
  return doneCount / closure.size
}
