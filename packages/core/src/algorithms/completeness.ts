import type { VertoGraph, VertoNode } from '../types.js'
import { closureFor } from './closure.js'

/**
 * Effective weight for completeness and UsageBar bucket sums.
 * Returns a finite number > 0. Absent, zero, negative, non-numeric, and
 * non-finite values default to **1**. Numeric strings (e.g. from untyped
 * fieldMappings) are parsed when finite and positive.
 */
export function nodeWeight(node: VertoNode): number {
  const raw: unknown = node.weight
  if (raw === undefined || raw === null) return 1

  let n: number
  if (typeof raw === 'number') {
    n = raw
  } else if (typeof raw === 'string') {
    n = Number(raw.trim())
  } else {
    return 1
  }

  if (!Number.isFinite(n) || n <= 0) return 1
  return n
}

/**
 * Returns weighted delivery completeness for nodeId: the fraction of total
 * closure weight that is already done (isDone nodes contribute their full weight).
 * With all weights at the default 1, this equals the fraction of isDone nodes
 * in the closure.
 *
 * Returns **NaN** when `nodeId` is not present in the node index (unknown or
 * stale id) — distinct from 0 (valid, nothing done).
 *
 * When `nodeById` is supplied it must be built from the same `graph` passed as
 * the first argument; only the index is used for traversal and weights — a
 * mismatched pair produces silently wrong results.
 *
 * Prefer `deliveryCompletenessMap(graph)` when computing completeness for all
 * nodes in a bundle.
 */
export function deliveryCompleteness(
  graph: VertoGraph,
  nodeId: string,
  nodeById?: Map<string, VertoNode>,
): number {
  const index = nodeById ?? new Map(graph.nodes.map(n => [n.id, n]))
  if (!index.has(nodeId)) return Number.NaN

  const closure = closureFor(graph, nodeId, index)

  let doneWeight = 0
  let totalWeight = 0
  for (const id of closure) {
    const n = index.get(id)
    if (!n) continue
    const w = nodeWeight(n)
    totalWeight += w
    if (n.isDone) doneWeight += w
  }
  // nodeId is in index and always in closure; nodeWeight is always >= 1 → totalWeight >= 1.
  return doneWeight / totalWeight
}

/**
 * Weighted delivery completeness for every node in `graph` — one shared node
 * index (O(N²) DFS, O(N) index build).
 *
 * Duplicate `node.id` values are not rejected here or by `validateGraph()` today;
 * the shared index is last-wins per id. Extend validation before relying on
 * uniqueness guarantees.
 */
export function deliveryCompletenessMap(graph: VertoGraph): Record<string, number> {
  const nodeById = new Map(graph.nodes.map(n => [n.id, n]))
  const result: Record<string, number> = {}
  for (const node of graph.nodes) {
    result[node.id] = deliveryCompleteness(graph, node.id, nodeById)
  }
  return result
}
