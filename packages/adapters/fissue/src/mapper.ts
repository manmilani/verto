import { pathToFileURL } from 'node:url'
import type { VertoEdge, VertoGraph, VertoNode } from '@verto/core'
import { CANONICAL_VERTO_NODE_KEYS } from '@verto/core'
import type { FieldMappings, VertoConfig } from '@verto/config'
import { applyMappingTail } from '@verto/config'
import type { FissueProjectState, FissueStateTicket } from './system_types.js'
import { interpret } from './values.js'
import { requireFissueConfig } from './fissueConfig.js'

function clampPriority(raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null
  return Math.min(9, Math.max(1, Math.round(raw)))
}

function strings(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((s): s is string => typeof s === 'string')
  return typeof v === 'string' ? [v] : []
}

/**
 * fissue tickets → Verto graph (DESIGN.md §4.6.10). Values are interpreted by their fissue field
 * definitions; `body` comes from the ticket's Markdown body.
 */
export function mapTicketsToGraph(state: FissueProjectState, config: VertoConfig): VertoGraph {
  const fieldMappings: FieldMappings = requireFissueConfig(config).fieldMappings ?? {}
  const defs = state.config.fields
  const log: string[] = []

  // Duplicate IDs (exact text): the first in fissue's list order wins.
  const tickets: FissueStateTicket[] = []
  const seen = new Set<string>()
  for (const t of state.tickets) {
    if (seen.has(t.id)) {
      log.push(`duplicate ID ${t.id} (${t.file}) skipped`)
      continue
    }
    seen.add(t.id)
    tickets.push(t)
  }

  const value = (t: FissueStateTicket, field: string): unknown =>
    field === 'body' ? (t.body ?? null) : interpret(defs[field], t.values[field])

  // References are kept only between distinct loaded tickets.
  const dropped: string[] = []
  const refs = (t: FissueStateTicket, field: string): string[] => {
    const out: string[] = []
    for (const id of strings(value(t, field))) {
      if (id === t.id || !seen.has(id)) dropped.push(`${t.id}.${field} → ${id}`)
      else if (!out.includes(id)) out.push(id)
    }
    return out
  }

  const subIssues = new Map(tickets.map(t => [t.id, refs(t, 'subIssues')]))
  const blockedBy = new Map(tickets.map(t => [t.id, refs(t, 'blockedBy')]))
  const children = new Set([...subIssues.values()].flat())

  // Dot entries are extracted by @verto/text-parser; their base fields are included in ticketFields.
  const directEntries = Object.entries(fieldMappings).filter(([, e]) => !e.from.field.includes('.'))
  const directFields = new Set(directEntries.map(([, e]) => e.from.field))
  const autoInclude = [...new Set(
    Object.values(fieldMappings)
      .filter(e => e.from.field.includes('.'))
      .map(e => e.from.field.slice(0, e.from.field.indexOf('.'))),
  )].filter(f => !directFields.has(f))

  const hasPersonaMapping = Boolean(fieldMappings['personas'])
  let emptyPriority = 0

  const nodes: VertoNode[] = tickets.map(t => {
    const title = value(t, 'title')
    const created = value(t, 'createdAt')
    const subs = subIssues.get(t.id)!
    const node: VertoNode = {
      id: t.id,
      title: typeof title === 'string' && title !== '' ? title : t.id,
      isDone: value(t, 'state') === 'CLOSED',
      isDeliverySlice: !children.has(t.id),
      priority: 5,
      prereqIds: [...new Set([...blockedBy.get(t.id)!, ...subs])],
      childIds: subs,
      ticketUrl: pathToFileURL(t.path).href,
      ...(typeof created === 'string' ? { created_at: created } : {}),
      nodeType: 'ticket',
      nodeOrigin: 'fissue',
      _rawReqIds: [],
      personas: hasPersonaMapping
        ? []
        : strings(value(t, 'labels'))
            .filter(l => l.startsWith('persona:'))
            .map(l => l.slice('persona:'.length)),
    }
    const ticketFields: Record<string, unknown> = {}
    let prioritySet = false

    for (const [key, entry] of directEntries) {
      const v = applyMappingTail(value(t, entry.from.field), entry.values, entry.type)
      if (key === 'priority') {
        const clamped = clampPriority(v)
        if (clamped !== null) {
          node.priority = clamped
          prioritySet = true
        }
      } else if (CANONICAL_VERTO_NODE_KEYS.has(key)) {
        if (v !== null) (node as unknown as Record<string, unknown>)[key] = v
      } else {
        ticketFields[key] = v
      }
    }
    if (!prioritySet && fieldMappings['priority']) emptyPriority++

    for (const field of autoInclude) {
      const v = value(t, field)
      if (v !== null && v !== undefined) ticketFields[field] = v
    }

    if (Object.keys(ticketFields).length > 0) node.ticketFields = ticketFields
    return node
  })

  const edges: VertoEdge[] = []
  for (const t of tickets) {
    for (const pred of blockedBy.get(t.id)!) edges.push({ from: pred, to: t.id, reason: 'blocking' })
    for (const child of subIssues.get(t.id)!) edges.push({ from: child, to: t.id, reason: 'parent-child' })
  }

  if (dropped.length > 0) log.push(`${dropped.length} link(s) to unloaded or same tickets dropped: ${dropped.join(', ')}`)
  if (emptyPriority > 0) log.push(`${emptyPriority} ticket(s): mapped priority empty or invalid, defaulting to 5`)
  for (const line of log) console.warn(`[verto] fissue: ${line}`)

  return { nodes, edges }
}
