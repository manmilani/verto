import type { DeliveryMapBundle, VertoNode } from '@verto/core'
import type { DisplayStatusGroup } from '@verto/config'
import { buildPipelineForSlice } from './pipelineRows.js'
import { isGap } from './displayStatusGroup.js'

export function countDoneNodes(bundle: DeliveryMapBundle): number {
  return bundle.graph.nodes.filter(n => n.isDone).length
}

export function countDirectDependents(bundle: DeliveryMapBundle, nodeId: string): number {
  return bundle.graph.edges.filter(e => e.from === nodeId).length
}

export function deliveryMapStats(
  bundle: DeliveryMapBundle,
  _displayStatusGroups: DisplayStatusGroup[],
  pipelinesBySliceId?: ReadonlyMap<string, VertoNode[]>,
) {
  const slices = bundle.graph.nodes.filter(n => n.isDeliverySlice)
  const implOrder = bundle.implementationOrder ?? []

  let weightedSum = 0
  let built70 = 0
  let gapCount = 0

  for (const slice of slices) {
    const comp = bundle.deliveryCompleteness?.[slice.id] ?? 0
    weightedSum += comp
    if (comp >= 0.7) built70 += 1
    const pipeline = pipelinesBySliceId?.get(slice.id)
      ?? buildPipelineForSlice(slice.id, bundle.graph, implOrder)
    gapCount += pipeline.filter(row => isGap(row)).length
  }

  const overall = slices.length > 0 ? weightedSum / slices.length : 0

  return {
    sliceCount: slices.length,
    overall,
    built70,
    gapCount,
  }
}

export function ncnStats(bundle: DeliveryMapBundle) {
  const { graph } = bundle
  const total = graph.nodes.length
  const done = countDoneNodes(bundle)
  return {
    nodeCount: total,
    doneCount: done,
    readyCount: bundle.readyIds?.length ?? 0,
    edgeCount: graph.edges.length,
  }
}
