import type { VertoGraph, DeliveryMapBundle } from '@verto/core'
import { validateGraph, buildDeliveryMapBundle } from '@verto/core'
import type { FieldMappings } from '@verto/config'
import { materializeParsedRequirements } from './materialize.js'
import { computeBodyFields } from './computeBodyFields.js'
import { applyParsedFieldMappings } from './applyParsedFieldMappings.js'
import { filterParsedNodes } from './filter.js'
import { applyPriorityOverlay } from './applyPriorityOverlay.js'

export interface HostPipelineOptions {
  parsedEnabled?: boolean
  priorityOverlay?: Record<string, number | null>
  fieldMappings?: FieldMappings
}

export function runHostPipeline(
  graph: VertoGraph,
  opts?: HostPipelineOptions,
): DeliveryMapBundle {
  const parsedEnabled = opts?.parsedEnabled ?? true
  let g = materializeParsedRequirements(graph)
  g = computeBodyFields(g)
  if (opts?.fieldMappings) g = applyParsedFieldMappings(g, opts.fieldMappings)
  if (!parsedEnabled) g = filterParsedNodes(g)
  const result = validateGraph(g)
  if (!result.valid) {
    throw new Error(
      `Graph validation failed:\n${result.errors.map(e => e.message).join('\n')}`,
    )
  }
  result.warnings.forEach(w => console.warn('[verto]', w.message))
  if (opts?.priorityOverlay) g = applyPriorityOverlay(g, opts.priorityOverlay)
  return buildDeliveryMapBundle(g)
}
