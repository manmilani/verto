import type { VertoNode, VertoEdge, VertoGraph } from '../types.js'

/** Build a minimal VertoNode with sensible defaults. */
export function node(
  id: string,
  overrides: Partial<VertoNode> = {},
): VertoNode {
  return {
    id,
    title: id,
    isDone: false,
    isDeliverySlice: false,
    priority: 5,
    prereqIds: [],
    childIds: [],
    parsedReqs: [],
    personas: [],
    nodeType: 'ticket',
    nodeOrigin: 'test',
    status: undefined,
    ticketUrl: `https://example.com/${id}`,
    ...overrides,
  }
}

/** Build an edge (prereq → dependent). */
export function edge(from: string, to: string, reason: VertoEdge['reason'] = 'blocking'): VertoEdge {
  return { from, to, reason }
}

/**
 * Build a graph from a list of nodes and edges, automatically populating
 * each node's prereqIds from the edges.
 */
export function graph(nodes: VertoNode[], edges: VertoEdge[] = []): VertoGraph {
  // Populate prereqIds from edges
  const prereqMap = new Map<string, string[]>()
  for (const n of nodes) prereqMap.set(n.id, [...n.prereqIds])
  for (const e of edges) {
    const list = prereqMap.get(e.to) ?? []
    if (!list.includes(e.from)) list.push(e.from)
    prereqMap.set(e.to, list)
  }
  const populated = nodes.map(n => ({ ...n, prereqIds: prereqMap.get(n.id) ?? n.prereqIds }))
  return { nodes: populated, edges }
}
