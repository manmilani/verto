import type { VertoGraph, VertoNode } from '../types.js'

function checkReady(nodeById: Map<string, VertoNode>, node: VertoNode): boolean {
  return !node.isDone && node.prereqIds.every(id => nodeById.get(id)?.isDone === true)
}

/**
 * A node is ready when it is not done and all its direct prerequisites are done.
 * "Ready" nodes are where work can actually start right now.
 *
 * For bulk checks, prefer readyNodes() — it builds the lookup map once.
 */
export function isReady(graph: VertoGraph, node: VertoNode): boolean {
  return checkReady(new Map(graph.nodes.map(n => [n.id, n])), node)
}

/** All nodes in the graph that are currently ready to start. */
export function readyNodes(graph: VertoGraph): VertoNode[] {
  const nodeById = new Map(graph.nodes.map(n => [n.id, n]))
  return graph.nodes.filter(n => checkReady(nodeById, n))
}
