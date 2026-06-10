import type { VertoGraph } from '../types.js'

/**
 * Returns the transitive prerequisite closure for nodeId: the node itself plus
 * every node it directly or indirectly depends on. Iterative DFS; cycle-safe.
 */
export function closureFor(graph: VertoGraph, nodeId: string): Set<string> {
  const nodeById = new Map(graph.nodes.map(n => [n.id, n]))
  const visited = new Set<string>()
  const stack: string[] = [nodeId]

  while (stack.length > 0) {
    const id = stack.pop()!
    if (visited.has(id)) continue
    visited.add(id)
    const node = nodeById.get(id)
    if (node) {
      for (const prereqId of node.prereqIds) {
        if (!visited.has(prereqId)) stack.push(prereqId)
      }
    }
  }

  return visited
}
