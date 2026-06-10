import type { VertoGraph } from '../types.js'

/**
 * Computes the leverage score for every node: the count of nodes that
 * transitively depend on (sit above) a given node. In TOC terms this is the
 * node's constraint score — a higher score means more upward value is blocked
 * by this node's incompleteness. See DESIGN.md §3.3.
 */
export function leverageScores(graph: VertoGraph): Record<string, number> {
  // Build upward adjacency: dependents[id] = nodes that have id as a prereq
  const dependents = new Map<string, string[]>()
  for (const node of graph.nodes) dependents.set(node.id, [])
  for (const node of graph.nodes) {
    for (const prereqId of node.prereqIds) {
      const list = dependents.get(prereqId)
      if (list) list.push(node.id)
    }
  }

  const scores: Record<string, number> = {}

  for (const node of graph.nodes) {
    // BFS upward to count all transitive dependents (deduplicated)
    const seen = new Set<string>()
    const queue: string[] = [...(dependents.get(node.id) ?? [])]
    while (queue.length > 0) {
      const cur = queue.shift()!
      if (seen.has(cur)) continue
      seen.add(cur)
      for (const dep of dependents.get(cur) ?? []) {
        if (!seen.has(dep)) queue.push(dep)
      }
    }
    scores[node.id] = seen.size
  }

  return scores
}
