import { closureFor, type DeliveryMapBundle, type VertoGraph } from '@verto/core'

/**
 * The nodes a focus emphasises: the focused node's upstream closure (itself included) plus its
 * direct dependents. `undefined` = no focus (nothing dimmed). Every view dims ids outside the set.
 */
export function focusSet(graph: VertoGraph, focusId?: string): Set<string> | undefined {
  if (!focusId || !graph.nodes.some(n => n.id === focusId)) return undefined
  const set = closureFor(graph, focusId)
  for (const n of graph.nodes) {
    if (n.prereqIds.includes(focusId)) set.add(n.id)
  }
  return set
}

export function isDimmed(set: Set<string> | undefined, id: string): boolean {
  return set !== undefined && !set.has(id)
}

/** Journeys a node serves, excluding itself (a journey's closure contains the journey). */
export function servedSlices(bundle: DeliveryMapBundle, id: string): string[] {
  return (bundle.servedBySliceIds?.[id] ?? []).filter(sid => sid !== id)
}
