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

/** Priority's read rule after the mapping tail: a finite number, rounded and clamped to 1–9; else null. */
export function clampPriority(raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null
  return Math.min(9, Math.max(1, Math.round(raw)))
}

/** A dot entry's (e.g. `labels.persona`) coercion type, as `applyParsedFieldMappings` resolves it. */
function readType(entry: FieldMappingEntry): FieldMappingEntry['type'] {
  if (!entry.from.field.includes('.')) return entry.type
  return entry.type === 'select' || entry.type === 'iteration' ? 'text' : entry.type ?? 'text'
}

/** One raw tracker value read through a mapping (§4.6.4): the mapping tail, then priority's clamp. */
export function readBack(raw: unknown, entry: FieldMappingEntry, key: string): unknown {
  const v = applyMappingTail(raw, entry.values, readType(entry))
  return key === 'priority' ? (Array.isArray(v) ? v.map(clampPriority) : clampPriority(v)) : v
}

/**
 * The tracker value to write for a canonical value (§4.6.11): with `values`, the first tracker value that
 * reads back as it (per list item); without, the value itself. None → an error naming the mapping.
 */
export function reverseMappedValue(
  value: unknown,
  entry: FieldMappingEntry,
  key: string,
): { ok: true; value: unknown } | { ok: false; error: string } {
  const values = entry.values
  if (!values) return { ok: true, value }
  const one = (item: unknown): string | undefined =>
    Object.keys(values).find(k => readBack(k, entry, key) === item)
  const items = Array.isArray(value) ? value : [value]
  const out: string[] = []
  for (const item of items) {
    const k = one(item)
    if (k === undefined) {
      return { ok: false, error: `no value in fieldMappings.${key}.values reads as ${JSON.stringify(item)}` }
    }
    out.push(k)
  }
  return { ok: true, value: Array.isArray(value) ? out : out[0] }
}

/**
 * The reverse of the labels path of `applyParsedFieldMappings`: the list edits that make `current` hold
 * exactly `sub:<item>` for each item (bare `sub` and other `sub:` items removed; other items untouched).
 */
export function dotItemsDiff(current: string[], sub: string, items: string[]): { add: string[]; remove: string[] } {
  const wanted = [...new Set(items.map(i => `${sub}:${i}`))]
  const remove = current.filter(l => (l === sub || l.startsWith(`${sub}:`)) && !wanted.includes(l))
  const add = wanted.filter(w => !current.includes(w))
  return { add, remove }
}

/** Tracker status options read through the `status` mapping: the Verto values the panel can offer. */
export function statusOptionsFor(trackerOptions: string[], entry: FieldMappingEntry | undefined): string[] {
  if (!entry) return trackerOptions
  const out = trackerOptions
    .map(o => readBack(o, entry, 'status'))
    .filter((v): v is string => typeof v === 'string' && v !== '')
  return [...new Set(out)]
}

/** Priority levels some tracker value reads back as; null = every level (no `values`). */
export function writableLevels(entry: FieldMappingEntry | undefined): number[] | null {
  if (!entry?.values) return null
  const levels = Object.keys(entry.values)
    .map(k => readBack(k, entry, 'priority'))
    .filter((v): v is number => typeof v === 'number')
  return [...new Set(levels)].sort((a, b) => a - b)
}
