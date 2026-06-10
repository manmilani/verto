import type { VertoGraph } from '../types.js'
import { leverageScores } from './leverage.js'

/**
 * Returns a dependency-respecting, priority-weighted topological ordering of
 * all not-done nodes using Kahn's algorithm. Pick policy among simultaneously
 * available nodes:
 *   1. Lowest globalPriorityRanking value (lower = do first)
 *   2. Highest leverage score (tie-break: bigger blocker first)
 *   3. Lexicographic node id (deterministic final tie-break)
 *
 * Done nodes are excluded. If the graph contains a cycle the remaining nodes
 * (stuck at non-zero in-degree) are appended in the same ranking+leverage+id
 * order at the end.
 *
 * @param precomputedLeverage  Optionally supply leverage scores already
 *   computed by buildDeliveryMapBundle to avoid a redundant BFS traversal.
 */
export function implementationOrder(
  graph: VertoGraph,
  rankings: Record<string, number>,
  precomputedLeverage?: Record<string, number>,
): string[] {
  const leverage = precomputedLeverage ?? leverageScores(graph)

  // Only consider not-done nodes
  const active = graph.nodes.filter(n => !n.isDone)
  const activeSet = new Set(active.map(n => n.id))

  // For each active node: which active nodes directly depend on it?
  const unlocks = new Map<string, string[]>()
  for (const node of active) unlocks.set(node.id, [])
  for (const node of active) {
    for (const prereqId of node.prereqIds) {
      if (activeSet.has(prereqId)) {
        unlocks.get(prereqId)!.push(node.id)
      }
    }
  }

  // In-degree within active set
  const inDeg = new Map<string, number>()
  for (const node of active) {
    inDeg.set(node.id, node.prereqIds.filter(id => activeSet.has(id)).length)
  }

  const compareNodes = (a: string, b: string): number => {
    const ra = rankings[a] ?? Infinity
    const rb = rankings[b] ?? Infinity
    if (ra !== rb) return ra - rb
    const la = leverage[a] ?? 0
    const lb = leverage[b] ?? 0
    if (la !== lb) return lb - la // higher leverage first
    return a < b ? -1 : 1
  }

  const pick = (candidates: string[]): string =>
    candidates.reduce((best, id) => (compareNodes(id, best) < 0 ? id : best))

  const available = active.filter(n => inDeg.get(n.id) === 0).map(n => n.id)
  const order: string[] = []
  const done = new Set<string>()

  while (available.length > 0) {
    const id = pick(available)
    available.splice(available.indexOf(id), 1)
    order.push(id)
    done.add(id)

    for (const depId of unlocks.get(id) ?? []) {
      const deg = (inDeg.get(depId) ?? 0) - 1
      inDeg.set(depId, deg)
      if (deg === 0) available.push(depId)
    }
  }

  // Any remaining nodes are in a cycle — append in ranking+leverage+id order
  const stuck = active
    .filter(n => !done.has(n.id))
    .sort((a, b) => compareNodes(a.id, b.id))
    .map(n => n.id)

  return [...order, ...stuck]
}
