import type { VertoGraph, VertoNode } from '@verto/core'
import { CANONICAL_VERTO_NODE_KEYS } from '@verto/core'
import type { FieldMappings, FieldMappingEntry } from '@verto/config'
import { coerceFieldValue } from '@verto/config'

export function applyParsedFieldMappings(
  graph: VertoGraph,
  fieldMappings: FieldMappings,
): VertoGraph {
  const dotEntries = collectDotEntries(fieldMappings)
  if (dotEntries.length === 0) return graph

  const nodes = graph.nodes.map(node => {
    if (node.nodeType !== 'ticket') return node
    let updated: VertoNode = node

    for (const { targetKey, baseField, parsedKey, resolvedType, resolvedIsArray, entry } of dotEntries) {
      const baseValue = node.ticketFields?.[baseField]
      if (baseValue === undefined || baseValue === null) continue

      const values = entry.values as Record<string, unknown> | undefined

      if (Array.isArray(baseValue)) {
        // Labels path
        const labels = baseValue as string[]
        if (resolvedIsArray) {
          const arr = parseLabelsField(labels, parsedKey, true)
          const coerced = arr.map(slot =>
            slot === null ? null : applyValuesAndCoerce(slot, resolvedType, values),
          )
          updated = routeParsedValue(updated, targetKey, coerced)
        } else {
          const raw = parseLabelsField(labels, parsedKey, false)
          if (raw === null && resolvedType === 'boolean') {
            // Boolean KEY-only synthesis: parser found no KEY:VALUE match; check bare presence
            const synthesized = labels.includes(parsedKey)
            updated = routeParsedValue(updated, targetKey, synthesized)
          } else {
            const coerced = applyValuesAndCoerce(raw, resolvedType, values)
            updated = routeParsedValue(updated, targetKey, coerced)
          }
        }
      } else if (typeof baseValue === 'string') {
        // Text-block path
        if (resolvedIsArray) {
          const arr = parseTextBlock(baseValue, parsedKey, true)
          if (arr !== null) {
            const coerced = arr.map(slot => applyValuesAndCoerce(slot, resolvedType, values))
            updated = routeParsedValue(updated, targetKey, coerced)
          }
        } else {
          const raw = parseTextBlock(baseValue, parsedKey, false)
          const coerced = applyValuesAndCoerce(raw, resolvedType, values)
          updated = routeParsedValue(updated, targetKey, coerced)
        }
      }
      // Non-string/non-array base field types are silently skipped
    }

    return updated
  })

  return { nodes, edges: graph.edges }
}

interface DotEntry {
  targetKey: string
  baseField: string
  parsedKey: string
  resolvedType: FieldMappingEntry['type']
  resolvedIsArray: boolean
  entry: FieldMappingEntry
}

function collectDotEntries(fieldMappings: FieldMappings): DotEntry[] {
  const entries: DotEntry[] = []
  for (const [targetKey, entry] of Object.entries(fieldMappings)) {
    const dot = entry.from.field.indexOf('.')
    if (dot === -1) continue
    const rawType = entry.type
    const resolvedType: FieldMappingEntry['type'] =
      rawType === 'select' || rawType === 'iteration' ? 'text' : rawType ?? 'text'
    const resolvedIsArray = entry.isArray ?? false
    entries.push({
      targetKey,
      baseField: entry.from.field.slice(0, dot),
      parsedKey: entry.from.field.slice(dot + 1),
      resolvedType,
      resolvedIsArray,
      entry,
    })
  }
  return entries
}

function applyValuesAndCoerce(
  raw: string | null,
  resolvedType: FieldMappingEntry['type'],
  values: Record<string, unknown> | undefined,
): unknown {
  if (raw === null) return null
  let remapped: unknown = raw
  if (values) {
    remapped = values[raw] ?? null
  }
  return coerceFieldValue(remapped, resolvedType)
}

/**
 * Parses a label array for a given key. Pure extractor — never synthesizes booleans.
 *
 * isArray: false — returns first KEY:VALUE raw string, or null on miss (whether bare KEY exists or not).
 *   Multiple matches: warn and take first.
 * isArray: true — returns (string | null)[] of all matches in order; bare KEY → null slot; no matches → [].
 */
export function parseLabelsField(labels: string[], key: string, isArray: false): string | null
export function parseLabelsField(labels: string[], key: string, isArray: true): (string | null)[]
export function parseLabelsField(
  labels: string[],
  key: string,
  isArray: boolean,
): string | null | (string | null)[] {
  const prefix = `${key}:`

  if (isArray) {
    const result: (string | null)[] = []
    for (const l of labels) {
      if (l.startsWith(prefix)) {
        result.push(l.slice(prefix.length))
      } else if (l === key) {
        result.push(null)
      }
    }
    return result
  }

  // isArray: false
  const keyValues = labels.filter(l => l.startsWith(prefix))
  if (keyValues.length > 1) {
    console.warn(
      `[verto] parseLabelsField: multiple "${key}:*" labels found — taking first (${keyValues.length} total)`,
    )
  }
  if (keyValues.length > 0) return keyValues[0]!.slice(prefix.length)
  return null
}

/**
 * Extracts a raw-string block delimited by KEY:BEGIN/KEY:END markers (both plain
 * and HTML comment forms). Pure extractor — returns trimmed content or null.
 *
 * isArray: false — returns string | null.
 * isArray: true — returns [string] | null (one-element array or null if block absent/empty).
 */
export function parseTextBlock(body: string, key: string, isArray: false): string | null
export function parseTextBlock(body: string, key: string, isArray: true): [string] | null
export function parseTextBlock(
  body: string,
  key: string,
  isArray: boolean,
): string | null | [string] | null {
  const beginMarkers = new Set([`${key}:BEGIN`, `<!-- ${key}:BEGIN -->`])
  const endMarkers   = new Set([`${key}:END`,   `<!-- ${key}:END -->`])

  const lines = body.split('\n')
  let inBlock = false
  const blockLines: string[] = []

  for (const raw of lines) {
    const trimmed = raw.trimEnd().replace(/\r$/, '').trim()
    if (!inBlock) {
      if (beginMarkers.has(trimmed)) { inBlock = true }
      continue
    }
    if (endMarkers.has(trimmed)) break
    blockLines.push(raw)
  }

  if (!inBlock) return null
  const content = blockLines.join('\n').trim()
  if (!content) return null
  return isArray ? [content] : content
}

function routeParsedValue(
  node: VertoNode,
  key: string,
  value: unknown,
): VertoNode {
  if (value === null) return node
  const isCanonical = CANONICAL_VERTO_NODE_KEYS.has(key)
  if (isCanonical) return { ...node, [key]: value }
  return { ...node, ticketFields: { ...node.ticketFields, [key]: value } }
}
