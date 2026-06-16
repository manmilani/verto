import type { VertoGraph } from '@verto/core'

function dedupeIds(ids: string[]): string[] {
  return [...new Set(ids)]
}

/**
 * Removes all `nodeType: 'parsed'` nodes and `reason: 'parsed-req'` edges from the graph.
 * Clears `_rawReqIds` on remaining nodes and recomputes `prereqIds`.
 *
 * Never mutates the input graph — always returns new node/edge objects, even when no-op.
 */
export function filterParsedNodes(graph: VertoGraph): VertoGraph {
  // Build blocking-edge sources per ticket node (for prereqIds recomputation)
  const blockingSources = new Map<string, Set<string>>()
  for (const node of graph.nodes) {
    if (node.nodeType !== 'parsed') blockingSources.set(node.id, new Set())
  }
  for (const edge of graph.edges) {
    if (edge.reason === 'blocking' && blockingSources.has(edge.to)) {
      blockingSources.get(edge.to)!.add(edge.from)
    }
  }

  const filteredNodes = graph.nodes
    .filter(n => n.nodeType !== 'parsed')
    .map(node => {
      const newPrereqIds = dedupeIds([
        ...node.childIds,
        ...(blockingSources.get(node.id) ?? []),
      ])
      return {
        ...node,
        _rawReqIds: [],
        prereqIds: newPrereqIds,
      }
    })

  const filteredEdges = graph.edges.filter(e => e.reason !== 'parsed-req')

  return { nodes: filteredNodes, edges: filteredEdges }
}
