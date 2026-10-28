import type { VertoGraph, DeliveryMapBundle, VertoChange, ChangeState, ValidationResult, ImpliedSets } from '@verto/core'
import { validateGraph, buildDeliveryMapBundle, applyChanges, CANONICAL_VERTO_NODE_KEYS } from '@verto/core'
import type { FieldMappings } from '@verto/config'
import { clampPriority, readBack, reverseMappedValue } from '@verto/config'
import { materializeParsedRequirements } from './materialize.js'
import { computeBodyFields } from './computeBodyFields.js'
import { applyParsedFieldMappings } from './applyParsedFieldMappings.js'
import { filterParsedNodes } from './filter.js'

export interface HostPipelineOptions {
  parsedEnabled?: boolean
  /** The write-back draft (DESIGN.md §4.6.11), applied as a preview. */
  changes?: VertoChange[]
  fieldMappings?: FieldMappings
}

export interface ChangeStatus {
  state: ChangeState
  /** For `invalid`: the validation message of the first change that breaks the preview. */
  error?: string
}

export interface HostPipelineResult {
  bundle: DeliveryMapBundle
  /** One per draft change, in order. */
  changeStates: ChangeStatus[]
}

/**
 * A `set` moves every other node key mapped from the same tracker field (DESIGN.md §4.6.11): each reads
 * back the tracker value the write would store, as the next load will.
 */
export function mappedImpliedSets(mappings: FieldMappings): ImpliedSets {
  return c => {
    const entry = mappings[c.key]
    if (!entry) return []
    const written = reverseMappedValue(c.key === 'priority' ? clampPriority(c.value) : c.value, entry, c.key)
    if (!written.ok) return []
    return Object.entries(mappings).flatMap(([key, e]) => {
      if (key === c.key || !CANONICAL_VERTO_NODE_KEYS.has(key)) return []
      if (e.from.kind !== entry.from.kind || e.from.field !== entry.from.field) return []
      const value = readBack(written.value, e, key)
      return value === null || value === undefined ? [] : [{ key, value }]
    })
  }
}

function validationMessage(result: ValidationResult): string {
  return `Graph validation failed:\n${result.errors.map(e => e.message).join('\n')}`
}

/**
 * The host pipeline (DESIGN.md §4.6.5). The draft is applied after parsed mappings (so a drafted
 * `personas` isn't overwritten) and before validation. A draft that doesn't validate never fails the
 * load: the longest valid prefix is applied and the remaining changes are `invalid`. The tracker graph
 * itself failing validation throws.
 */
export function runHostPipeline(
  graph: VertoGraph,
  opts?: HostPipelineOptions,
): HostPipelineResult {
  const parsedEnabled = opts?.parsedEnabled ?? true
  const changes = opts?.changes ?? []
  let enriched = materializeParsedRequirements(graph)
  enriched = computeBodyFields(enriched)
  if (opts?.fieldMappings) enriched = applyParsedFieldMappings(enriched, opts.fieldMappings)

  const implied = opts?.fieldMappings ? mappedImpliedSets(opts.fieldMappings) : undefined
  const attempt = (count: number) => {
    const applied = applyChanges(enriched, changes.slice(0, count), implied)
    const g = parsedEnabled ? applied.graph : filterParsedNodes(applied.graph)
    return { g, states: applied.states, result: validateGraph(g) }
  }

  let count = changes.length
  let current = attempt(count)
  let breakMessage: string | undefined
  while (!current.result.valid) {
    if (count === 0) throw new Error(validationMessage(current.result))
    breakMessage = validationMessage(current.result)
    current = attempt(--count)
  }
  current.result.warnings.forEach(w => console.warn('[verto]', w.message))

  const changeStates: ChangeStatus[] = changes.map((_, i) =>
    i < count ? { state: current.states[i]! } : { state: 'invalid', error: breakMessage },
  )
  return { bundle: buildDeliveryMapBundle(current.g), changeStates }
}
