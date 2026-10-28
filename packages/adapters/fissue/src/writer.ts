import type { VertoChange, WriteHooks, WriteResult } from '@verto/core'
import { changeNodeIds, isTempId, sameTarget } from '@verto/core'
import type { FieldMappingEntry, FieldMappings } from '@verto/config'
import { clampPriority, dotItemsDiff, readBack, reverseMappedValue } from '@verto/config'
import { fissueWriteMappings } from './defaults.js'
import type { FissueApiV1, FissueFieldDef, FissueInput, FissueProjectState, FissueUpdateInput } from './system_types.js'
import { interpret } from './values.js'

/** fissue's own fields: never registered by Verto (a missing one fails the change). */
const SYSTEM_FIELDS = new Set(['title', 'state', 'labels', 'blockedBy', 'parent', 'subIssues'])

/** How `personas` is written when unmapped: as the read path's `persona:` labels. */
const PERSONAS_ENTRY: FieldMappingEntry = { from: { kind: 'issue', field: 'labels.persona' }, isArray: true }

type Mode = 'set' | 'add' | 'remove'

interface Op {
  field: string
  mode: Mode
  value: FissueInput
  /** The value holds ticket ids (remapped once creates have run). */
  ref?: boolean
}

interface Need {
  field: string
  def: Record<string, unknown>
  line: string
}

interface Plan {
  ticket: string
  ops: Op[]
  /** What conflicts are judged on: the ops, plus for a dot entry a `set` of its dot path. */
  claims?: Op[]
  /** fissue fields this change needs registered. */
  needs: Need[]
  /** The default write mapping it goes through (added to the workspace config). */
  mapping?: { key: string; entry: FieldMappingEntry }
}

type Resolved = { ok: true; plan: Plan } | { ok: false; error: string }

interface Context {
  mappings: FieldMappings
  state: FissueProjectState
}

const fail = (error: string): Resolved => ({ ok: false, error })
const ok = (plan: Plan): Resolved => ({ ok: true, plan })

function strings(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((s): s is string => typeof s === 'string')
  return typeof v === 'string' ? [v] : []
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

function rawOf(v: FissueInput): string | string[] | null {
  if (v === null) return null
  return Array.isArray(v) ? v.map(String) : String(v)
}

/** The fissue field definition Verto registers for a mapped field it writes. */
function registration(field: string, entry: FieldMappingEntry, key: string, dot: boolean): Need & { asDef: FissueFieldDef } {
  const kind = entry.from.kind === 'issue' ? 'issue' : 'issueField'
  let type: FissueFieldDef['type']
  let options: { name: string }[] | undefined
  if (dot) type = 'text'
  else if (entry.values) {
    type = 'select'
    options = Object.keys(entry.values).map(name => ({ name }))
  } else if (entry.type === 'select' || entry.type === 'iteration') type = 'text'
  else type = entry.type ?? (key === 'priority' ? 'number' : key === 'isDone' ? 'boolean' : 'text')
  const isArray = dot || (entry.isArray ?? false)
  const def = { kind, type, isArray, ...(options ? { options } : {}) }
  const line = `${field}: ${isArray ? 'list of ' : ''}${type}${options ? ` (${options.map(o => o.name).join(', ')})` : ''}`
  return { field, def, line, asDef: def }
}

function resolve(c: VertoChange, ctx: Context): Resolved {
  const defs = ctx.state.config.fields
  const tickets = new Map(ctx.state.tickets.map(t => [t.id, t]))
  for (const id of changeNodeIds(c)) {
    if (!isTempId(id) && !tickets.has(id)) return fail(`ticket ${id} is not in fissue`)
  }
  const missing = (field: string) => (defs[field] ? null : `fissue field ${field} is missing`)

  if (c.type === 'create') {
    if (c.title.trim() === '') return fail('a title is required')
    const e = missing('title') ?? missing('parent')
    return e ? fail(e) : ok({ ticket: c.nodeId, ops: [], needs: [] })
  }
  if (c.type === 'link') {
    const e = missing('blockedBy')
    if (e) return fail(e)
    return ok({ ticket: c.nodeId, needs: [], ops: [{ field: 'blockedBy', mode: c.add ? 'add' : 'remove', value: [c.blockerId], ref: true }] })
  }

  if (c.key === 'title' && (typeof c.value !== 'string' || c.value.trim() === '')) return fail('a title is required')
  let entry = ctx.mappings[c.key]
  let mapping: Plan['mapping']
  if (!entry) {
    if (c.key === 'title' || c.key === 'isDone') {
      const field = c.key === 'title' ? 'title' : 'state'
      const e = missing(field)
      if (e) return fail(e)
      const value = c.key === 'title' ? (c.value as string) : c.value ? 'CLOSED' : 'OPEN'
      return ok({ ticket: c.nodeId, needs: [], ops: [{ field, mode: 'set', value }] })
    }
    if (c.key === 'personas') entry = PERSONAS_ENTRY
    else if (fissueWriteMappings[c.key]) {
      entry = fissueWriteMappings[c.key]!
      mapping = { key: c.key, entry }
    } else return fail(`no fieldMappings.${c.key}`)
  }
  return resolveMapped(c, entry, mapping, ctx)
}

function resolveMapped(
  c: Extract<VertoChange, { type: 'set' }>,
  entry: FieldMappingEntry,
  mapping: Plan['mapping'],
  ctx: Context,
): Resolved {
  const key = c.key
  if (entry.from.kind === 'projectV2') return fail(`fieldMappings.${key} reads a GitHub project field; fissue can't write it`)
  const canonical = key === 'priority' ? clampPriority(c.value) : c.value
  const rv = reverseMappedValue(canonical, entry, key)
  if (!rv.ok) return fail(rv.error)
  const value = rv.value as FissueInput
  const defs = ctx.state.config.fields
  const field = entry.from.field
  const readsBack = (back: unknown) =>
    same(back, canonical) ? null : `${JSON.stringify(c.value)} doesn't read back through fieldMappings.${key}`
  const needFor = (f: string, dot: boolean): { needs: Need[]; def: FissueFieldDef } | string => {
    if (defs[f]) return { needs: [], def: defs[f]! }
    if (SYSTEM_FIELDS.has(f)) return `fissue field ${f} is missing`
    const r = registration(f, entry, key, dot)
    return { needs: [r], def: r.asDef }
  }

  const dot = field.indexOf('.')
  if (dot !== -1) {
    const base = field.slice(0, dot)
    const sub = field.slice(dot + 1)
    if (base === 'body' || (defs[base] && !defs[base]!.isArray)) {
      return fail(`fieldMappings.${key} reads text blocks in ${base}; writing into them is not supported`)
    }
    const need = needFor(base, true)
    if (typeof need === 'string') return fail(need)
    const items = (Array.isArray(value) ? value : [value]).map(String)
    const e = readsBack(readBack(entry.isArray ? items : items[0] ?? null, entry, key))
    if (e) return fail(e)
    const ticket = ctx.state.tickets.find(t => t.id === c.nodeId)
    const current = ticket ? strings(interpret(need.def, ticket.values[base])) : []
    const diff = dotItemsDiff(current, sub, items)
    const ops: Op[] = []
    if (diff.remove.length > 0) ops.push({ field: base, mode: 'remove', value: diff.remove })
    if (diff.add.length > 0) ops.push({ field: base, mode: 'add', value: diff.add })
    const claims: Op[] = [{ field, mode: 'set', value: items }, ...ops]
    return ok({ ticket: c.nodeId, ops, claims, needs: need.needs, ...(mapping ? { mapping } : {}) })
  }

  const need = needFor(field, false)
  if (typeof need === 'string') return fail(need)
  const read = interpret(need.def, rawOf(value) ?? undefined)
  if (need.def.type === 'select') {
    const names = (need.def.options ?? []).map(o => o.name)
    const bad = (Array.isArray(read) ? read : [read]).find(v => typeof v !== 'string' || !names.includes(v))
    if (bad !== undefined) return fail(`fissue field ${field} has no option ${JSON.stringify(bad)}`)
  }
  if (read === null || (Array.isArray(read) && read.some(v => v === null))) {
    return fail(`fissue field ${field} (${need.def.isArray ? 'list of ' : ''}${need.def.type}) can't hold ${JSON.stringify(value)}`)
  }
  const e = readsBack(readBack(read, entry, key))
  if (e) return fail(e)
  return ok({ ticket: c.nodeId, ops: [{ field, mode: 'set', value }], needs: need.needs, ...(mapping ? { mapping } : {}) })
}

function conflicts(a: Op, b: Op): boolean {
  if (a.field !== b.field) return false
  if (a.mode === 'set' || b.mode === 'set') return a.mode !== b.mode || !same(a.value, b.value)
  if (a.mode === b.mode) return false
  const bs = strings(b.value)
  return strings(a.value).some(x => bs.includes(x))
}

function codeOf(e: unknown): unknown {
  return e !== null && typeof e === 'object' ? (e as { code?: unknown }).code : undefined
}

/** The tracker field two plans disagree on, or null (they merge). */
function conflictField(a: Plan, b: Plan): string | null {
  if (a.ticket !== b.ticket) return null
  const claims = (p: Plan) => p.claims ?? p.ops
  return claims(a).find(x => claims(b).some(y => conflicts(x, y)))?.field ?? null
}

/**
 * Edit-time check (DESIGN.md §4.6.11): why the change can't be written, or null. That includes a
 * conflict with another change in `draft` (the change it replaces excluded).
 */
export function checkChange(
  mappings: FieldMappings,
  state: FissueProjectState,
  change: VertoChange,
  draft: VertoChange[] = [],
): string | null {
  const ctx = { mappings, state }
  const r = resolve(change, ctx)
  if (!r.ok) return r.error
  for (const other of draft) {
    if (sameTarget(other, change)) continue
    const o = resolve(other, ctx)
    const field = o.ok ? conflictField(r.plan, o.plan) : null
    if (field) return `conflicts with ${describe(other)} (both write ${field})`
  }
  return null
}

function describe(c: VertoChange): string {
  if (c.type === 'set') return `the ${c.key} change on ${c.nodeId}`
  if (c.type === 'link') return `the blocker change on ${c.nodeId}`
  return `the new ticket ${c.nodeId}`
}

/** Write the draft (DESIGN.md §4.6.11): every change not reported in `failed` was written. */
export async function writeChanges(
  api: FissueApiV1,
  root: string,
  mappings: FieldMappings,
  state: FissueProjectState,
  changes: VertoChange[],
  hooks: WriteHooks,
): Promise<WriteResult> {
  const errors = new Map<number, string>()
  const live = (i: number) => !errors.has(i)
  const plans = changes.map(c => resolve(c, { mappings, state }))
  plans.forEach((p, i) => { if (!p.ok) errors.set(i, p.error) })
  const plan = (i: number) => (plans[i] as { plan: Plan }).plan

  const created: Record<string, string> = {}
  const createIndex = new Map(changes.flatMap((c, i) => (c.type === 'create' ? [[c.nodeId, i] as const] : [])))
  const cascade = () => {
    for (let again = true; again;) {
      again = false
      changes.forEach((c, i) => {
        if (!live(i)) return
        const dead = changeNodeIds(c).find(id =>
          isTempId(id) && !(c.type === 'create' && id === c.nodeId) && !created[id]
          && (createIndex.get(id) === undefined || !live(createIndex.get(id)!)))
        if (dead) {
          errors.set(i, `depends on failed create ${dead}`)
          again = true
        }
      })
    }
  }
  cascade()

  // Conflicts: changes to one ticket merge unless they disagree on a field.
  const resolved = changes.map((_, i) => live(i))
  changes.forEach((_, i) => {
    if (!resolved[i]) return
    changes.forEach((__, j) => {
      if (j <= i || !resolved[j]) return
      const field = conflictField(plan(i), plan(j))
      if (field) {
        errors.set(i, `conflicting changes to ${field}`)
        errors.set(j, `conflicting changes to ${field}`)
      }
    })
  })
  cascade()

  // Registration and default write mappings: one confirmation.
  const needs = new Map<string, Need>()
  const mappingsUsed = new Map<string, FieldMappingEntry>()
  changes.forEach((_, i) => {
    if (!live(i)) return
    for (const n of plan(i).needs) if (!needs.has(n.field)) needs.set(n.field, n)
    const m = plan(i).mapping
    if (m) mappingsUsed.set(m.key, m.entry)
  })
  if (needs.size > 0 || mappingsUsed.size > 0) {
    const yes = await hooks.confirm({
      register: [...needs.values()].map(n => n.line),
      addMappings: [...mappingsUsed].map(([k, e]) => `${k} ← ${e.from.kind} ${e.from.field}`),
    })
    if (!yes) {
      changes.forEach((_, i) => {
        if (!live(i)) return
        const p = plan(i)
        if (p.needs.length > 0) errors.set(i, `fissue field ${p.needs[0]!.field} not registered (declined)`)
        else if (p.mapping) errors.set(i, `fieldMappings.${p.mapping.key} not added (declined)`)
      })
    } else {
      for (const n of needs.values()) {
        try {
          await api.addField(root, n.field, n.def)
        } catch (e) {
          changes.forEach((_, i) => {
            if (live(i) && plan(i).needs.some(x => x.field === n.field)) {
              errors.set(i, `can't register fissue field ${n.field}: ${message(e)}`)
            }
          })
        }
      }
    }
  }
  // Creates, in draft order.
  const before = new Set(state.tickets.map(t => t.id))
  for (const [i, c] of changes.entries()) {
    cascade()
    if (c.type !== 'create' || !live(i)) continue
    const parent = created[c.parentId] ?? c.parentId
    try {
      created[c.nodeId] = (await api.createTicket(root, { title: c.title, parent })).id
    } catch (e) {
      const fresh = await api.projectState(root).catch(() => null)
      const taken = new Set(Object.values(created))
      const found = fresh?.tickets.find(t =>
        !before.has(t.id) && !taken.has(t.id)
        && t.values['title'] === c.title && strings(t.values['parent']).includes(parent))
      if (found) created[c.nodeId] = found.id
      else errors.set(i, message(e))
    }
  }
  cascade()

  // Updates: one per ticket.
  const groups = new Map<string, number[]>()
  changes.forEach((c, i) => {
    if (!live(i) || c.type === 'create') return
    const ticket = created[plan(i).ticket] ?? plan(i).ticket
    groups.set(ticket, [...(groups.get(ticket) ?? []), i])
  })
  for (const [ticket, indices] of groups) {
    const input: FissueUpdateInput = {}
    for (const i of indices) {
      for (const op of plan(i).ops) {
        const value = op.ref ? strings(op.value).map(id => created[id] ?? id) : op.value
        const into = (input[op.mode] ??= {})
        into[op.field] = op.mode === 'set' ? value : [...new Set([...strings(into[op.field]), ...strings(value)])]
      }
    }
    if (Object.keys(input).length === 0) continue
    try {
      await api.updateTicket(root, ticket, input).catch(e => {
        if (codeOf(e) === 'changed-on-disk') return api.updateTicket(root, ticket, input)
        throw e
      })
    } catch (e) {
      for (const i of indices) errors.set(i, message(e))
    }
  }

  // Default write mappings that a written change went through.
  const addMappings: Record<string, unknown> = {}
  changes.forEach((_, i) => {
    const m = live(i) ? plan(i).mapping : undefined
    if (m) addMappings[m.key] = m.entry
  })

  return {
    failed: [...errors].sort(([a], [b]) => a - b).map(([i, error]) => ({ change: changes[i]!, error })),
    createdIds: created,
    addMappings,
  }
}
