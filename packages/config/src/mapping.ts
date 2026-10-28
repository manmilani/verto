import { coerceFieldValue } from './coerce.js'
import type { FieldMappingEntry, FieldMappings, VertoConfig } from './types.js'

/** An adapter's own config block: the one named by `config.adapter` (e.g. `github`, `fissue`). */
export interface AdapterBlock {
  fieldMappings?: FieldMappings
  [key: string]: unknown
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

/** The block named by `config.adapter`, if it is an object. */
export function adapterBlock(config: VertoConfig): AdapterBlock | undefined {
  const block = (config as unknown as Record<string, unknown>)[config.adapter]
  return isPlainObject(block) ? (block as AdapterBlock) : undefined
}

/** The adapter's `fieldMappings` (DESIGN.md §4.6.4). */
export function adapterFieldMappings(config: VertoConfig): FieldMappings | undefined {
  return adapterBlock(config)?.fieldMappings
}

/** `config` without the given `fieldMappings` keys in its adapter block (the field check's skip, §4.6.4). */
export function withoutMappings(config: VertoConfig, keys: Iterable<string>): VertoConfig {
  const drop = new Set(keys)
  const block = adapterBlock(config)
  if (drop.size === 0 || !block?.fieldMappings) return config
  const fieldMappings = Object.fromEntries(Object.entries(block.fieldMappings).filter(([k]) => !drop.has(k)))
  return { ...config, [config.adapter]: { ...block, fieldMappings } } as VertoConfig
}

/**
 * The shared tail of every field mapping (§4.6.4): for each list item (or the scalar), `values` is
 * applied (a miss → `null`), then `coerceFieldValue(type)`. `null` items stay `null`.
 */
export function applyMappingTail(
  value: unknown,
  values: Record<string, unknown> | undefined,
  type: FieldMappingEntry['type'],
): unknown {
  const one = (v: unknown): unknown => {
    if (v === null || v === undefined) return null
    const key = String(v)
    const mapped = values ? (Object.hasOwn(values, key) ? values[key] ?? null : null) : v
    return coerceFieldValue(mapped, type)
  }
  return Array.isArray(value) ? value.map(one) : one(value)
}
