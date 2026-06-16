import type { VertoGraph, DeliveryMapBundle } from '@verto/core'
import { validateGraph, buildDeliveryMapBundle } from '@verto/core'
import { materializeParsedRequirements } from './materialize.js'
import { computeBodyFields } from './computeBodyFields.js'
import { filterParsedNodes } from './filter.js'

export interface HostPipelineOptions {
  parsedEnabled?: boolean
}

export function runHostPipeline(
  graph: VertoGraph,
  opts?: HostPipelineOptions,
): DeliveryMapBundle {
  const parsedEnabled = opts?.parsedEnabled ?? true
  let g = materializeParsedRequirements(graph)
  g = computeBodyFields(g)
  if (!parsedEnabled) g = filterParsedNodes(g)
  const result = validateGraph(g)
  if (!result.valid) {
    throw new Error(
      `Graph validation failed:\n${result.errors.map(e => e.message).join('\n')}`,
    )
  }
  result.warnings.forEach(w => console.warn('[verto]', w.message))
  return buildDeliveryMapBundle(g)
}
