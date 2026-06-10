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
 * (stuck at non-zero in-degree) are appended in ranking order at the end.
 */
export function implementationOrder(
  graph: VertoGraph,
  rankings: Record<string, number>,
): string[] {
  const leverage = leverageScores(graph)

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

  const pick = (candidates: string[]): string =>
    candidates.reduce((best, id) => {
      const rBest = rankings[best] ?? Infinity
      const rId = rankings[id] ?? Infinity
      if (rId !== rBest) return rId < rBest ? id : best
      const lBest = leverage[best] ?? 0
      const lId = leverage[id] ?? 0
      if (lId !== lBest) return lId > lBest ? id : best
      return id < best ? id : best
    })

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

  // Any remaining nodes are in a cycle — append in ranking order
  const stuck = active
    .filter(n => !done.has(n.id))
    .sort((a, b) => {
      const ra = rankings[a.id] ?? Infinity
      const rb = rankings[b.id] ?? Infinity
      return ra !== rb ? ra - rb : a.id < b.id ? -1 : 1
    })
    .map(n => n.id)

  return [...order, ...stuck]
}
