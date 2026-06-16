import type { VertoGraph, VertoNode, VertoEdge } from '@verto/core'
import { parseRawReqBlock } from './parseRawReqBlock.js'

function dedupeIds(ids: string[]): string[] {
  return [...new Set(ids)]
}

/**
 * Materializes RAW_REQ:BEGIN/END blocks in ticket bodies into synthetic
 * `nodeType: 'parsed'` graph nodes with corresponding `parsed-req` edges.
 *
 * Not idempotent — call exactly once on the fresh adapter-returned graph inside runHostPipeline.
 * Never mutates the input graph.
 */
export function materializeParsedRequirements(graph: VertoGraph): VertoGraph {
  // Build blocking-edge sources per node (needed for prereqIds recomputation later)
  const blockingSources = new Map<string, Set<string>>()
  for (const node of graph.nodes) blockingSources.set(node.id, new Set())
  for (const edge of graph.edges) {
    if (edge.reason === 'blocking' && blockingSources.has(edge.to)) {
      blockingSources.get(edge.to)!.add(edge.from)
    }
  }

  // Track per-parent updates: raw-req ids created for each ticket node
  const rawReqIdsMap = new Map<string, string[]>()
  const newParsedNodes: VertoNode[] = []
  const newParsedEdges: VertoEdge[] = []

  for (const node of graph.nodes) {
    if (node.nodeType !== 'ticket') continue
    const body = node.ticketFields?.['body']
    if (typeof body !== 'string' || !body) continue

    const reqs = parseRawReqBlock(body, node.id)
    if (reqs.length === 0) continue

    const parsedIds: string[] = []
    for (const req of reqs) {
      newParsedNodes.push({
        id: req.id,
        title: req.name,
        isDone: req.isDone,
        isDeliverySlice: false,
        priority: 5,
        nodeType: 'parsed',
        nodeOrigin: 'text-parser',
        prereqIds: [],
        childIds: [],
        _rawReqIds: [],
        personas: [],
        status: req.status,
        ticketUrl: node.ticketUrl + req.id.slice(node.id.length),
        _note: req.note,
        ticketFields: {},
      })
      newParsedEdges.push({ from: req.id, to: node.id, reason: 'parsed-req' })
      parsedIds.push(req.id)
    }
    rawReqIdsMap.set(node.id, parsedIds)
  }

  // Rebuild all ticket nodes: update _rawReqIds and recompute prereqIds
  const updatedTicketNodes: VertoNode[] = graph.nodes.map(node => {
    if (node.nodeType !== 'ticket') return { ...node }
    const newRawReqIds = rawReqIdsMap.get(node.id) ?? node._rawReqIds
    const newPrereqIds = dedupeIds([
      ...node.childIds,
      ...newRawReqIds,
      ...(blockingSources.get(node.id) ?? []),
    ])
    return {
      ...node,
      _rawReqIds: newRawReqIds,
      prereqIds: newPrereqIds,
    }
  })

  return {
    nodes: [...updatedTicketNodes, ...newParsedNodes],
    edges: [...graph.edges, ...newParsedEdges],
  }
}
