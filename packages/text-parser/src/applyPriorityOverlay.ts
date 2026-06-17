import type { VertoGraph } from '@verto/core'

/**
 * Returns a new graph with delivery-slice priorities overridden by the supplied
 * overlay map. Non-slice nodes are always returned unchanged.
 *
 * overlay[sliceId] semantics:
 *   number  — use this value (clamped 1–9 as insurance against stale workspaceState)
 *   null    — cleared override; keep original tracker priority
 *   missing — no override; keep original tracker priority
 */
export function applyPriorityOverlay(
  graph: VertoGraph,
  overlay: Record<string, number | null>,
): VertoGraph {
  const nodes = graph.nodes.map(node => {
    if (!node.isDeliverySlice) return node
    const val = overlay[node.id]
    if (val === undefined || val === null) return node
    return { ...node, priority: Math.max(1, Math.min(9, Math.round(val))) }
  })
  return { ...graph, nodes }
}
