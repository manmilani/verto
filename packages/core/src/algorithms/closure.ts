import type { VertoGraph, VertoNode } from '../types.js'

/**
 * Returns the transitive prerequisite closure for nodeId: the node itself plus
 * every node it directly or indirectly depends on. Iterative DFS; cycle-safe.
 *
 * Optional `nodeById` avoids rebuilding the index when called repeatedly (e.g.
 * `deliveryCompletenessMap`). When supplied, it must index the same nodes as
 * `graph.nodes`; `graph` is not consulted for topology when `nodeById` is set.
 */
export function closureFor(
  graph: VertoGraph,
  nodeId: string,
  nodeById?: Map<string, VertoNode>,
): Set<string> {
  const index = nodeById ?? new Map(graph.nodes.map(n => [n.id, n]))
  const visited = new Set<string>()
  const stack: string[] = [nodeId]

  while (stack.length > 0) {
    const id = stack.pop()!
    if (visited.has(id)) continue
    visited.add(id)
    const node = index.get(id)
    if (node) {
      for (const prereqId of node.prereqIds) {
        if (!visited.has(prereqId)) stack.push(prereqId)
      }
    }
  }

  return visited
}
