import type { VertoGraph, VertoNode } from '../types.js'

/**
 * A node is ready when it is not done and all its direct prerequisites are done.
 * "Ready" nodes are where work can actually start right now.
 */
export function isReady(graph: VertoGraph, node: VertoNode): boolean {
  if (node.isDone) return false
  const nodeById = new Map(graph.nodes.map(n => [n.id, n]))
  return node.prereqIds.every(id => nodeById.get(id)?.isDone === true)
}

/** All nodes in the graph that are currently ready to start. */
export function readyNodes(graph: VertoGraph): VertoNode[] {
  const nodeById = new Map(graph.nodes.map(n => [n.id, n]))
  return graph.nodes.filter(n =>
    !n.isDone && n.prereqIds.every(id => nodeById.get(id)?.isDone === true),
  )
}
