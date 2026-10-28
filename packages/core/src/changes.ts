import type { VertoEdge, VertoGraph, VertoNode } from './types.js'

/**
 * Write-back change model (DESIGN.md §4.6.11). Every edit made in the panel is a `VertoChange` in one
 * ordered draft; the preview is the loaded graph with the draft applied.
 */

export type EditableKey = 'title' | 'priority' | 'status' | 'isDone' | 'personas'
export const EDITABLE_KEYS: readonly EditableKey[] = ['title', 'priority', 'status', 'isDone', 'personas']

export type VertoChange =
  | { type: 'set'; nodeId: string; key: EditableKey; value: string | number | boolean | string[] }
  /** `blockerId` blocks `nodeId` (a `blocking` edge from blockerId to nodeId). */
  | { type: 'link'; nodeId: string; blockerId: string; add: boolean }
  /** A new child ticket of `parentId`; `nodeId` is a temp id (`new:<n>`) until written. */
  | { type: 'create'; nodeId: string; parentId: string; title: string }

/**
 * `applied`: changes the preview. `noop`: the target already has that state. `notLoaded`: a node it needs
 * isn't a loaded ticket node. `invalid`: the preview with the draft doesn't validate (set by the host).
 */
export type ChangeState = 'applied' | 'noop' | 'notLoaded' | 'invalid'

export const TEMP_ID_PREFIX = 'new:'
export const DRAFT_URL_SCHEME = 'verto-draft:'

export function isTempId(id: string): boolean {
  return id.startsWith(TEMP_ID_PREFIX)
}

/** Two changes with the same target: a draft holds at most one change per target. */
export function sameTarget(a: VertoChange, b: VertoChange): boolean {
  if (a.type !== b.type || a.nodeId !== b.nodeId) return false
  if (a.type === 'set') return a.key === (b as typeof a).key
  if (a.type === 'link') return a.blockerId === (b as typeof a).blockerId
  return true
}

/** The draft with `c` replacing the change with the same target (in place), or appended. */
export function upsertChange(changes: VertoChange[], c: VertoChange): VertoChange[] {
  const i = changes.findIndex(x => sameTarget(x, c))
  if (i === -1) return [...changes, c]
  return changes.map((x, j) => (j === i ? c : x))
}

/** Node ids a change refers to. */
export function changeNodeIds(c: VertoChange): string[] {
  if (c.type === 'link') return [c.nodeId, c.blockerId]
  if (c.type === 'create') return [c.nodeId, c.parentId]
  return [c.nodeId]
}

/**
 * The draft without `drop` (matched by target; omitted = everything). Dropping a create also drops every
 * change that refers to its temp id, transitively.
 */
export function discardChanges(changes: VertoChange[], drop?: VertoChange[]): VertoChange[] {
  if (!drop) return []
  let kept = changes.filter(c => !drop.some(d => sameTarget(c, d)))
  const gone = new Set(changes.filter(c => c.type === 'create' && !kept.includes(c)).map(c => c.nodeId))
  for (let size = -1; size !== gone.size;) {
    size = gone.size
    kept = kept.filter(c => {
      if (!changeNodeIds(c).some(id => gone.has(id))) return true
      if (c.type === 'create') gone.add(c.nodeId)
      return false
    })
  }
  return kept
}

/** A temp id not used by any create in the draft. */
export function nextTempId(changes: VertoChange[]): string {
  let max = 0
  for (const c of changes) {
    if (c.type !== 'create' || !isTempId(c.nodeId)) continue
    const n = Number(c.nodeId.slice(TEMP_ID_PREFIX.length))
    if (Number.isInteger(n) && n > max) max = n
  }
  return `${TEMP_ID_PREFIX}${max + 1}`
}

/** The changes with node ids replaced through `ids` (temp id → tracker id). */
export function remapNodeIds(changes: VertoChange[], ids: Record<string, string>): VertoChange[] {
  const m = (id: string) => (Object.hasOwn(ids, id) ? ids[id]! : id)
  return changes.map(c => {
    if (c.type === 'link') return { ...c, nodeId: m(c.nodeId), blockerId: m(c.blockerId) }
    if (c.type === 'create') return { ...c, nodeId: m(c.nodeId), parentId: m(c.parentId) }
    return { ...c, nodeId: m(c.nodeId) }
  })
}

/** Same clamp as `@verto/config`'s (core doesn't depend on config). */
function clampPriority(n: number): number {
  return Math.min(9, Math.max(1, Math.round(n)))
}

function sameValue(key: EditableKey, a: unknown, b: unknown): boolean {
  if (key === 'personas') {
    const as = new Set(Array.isArray(a) ? a : [])
    const bs = new Set(Array.isArray(b) ? b : [])
    return as.size === bs.size && [...as].every(x => bs.has(x))
  }
  return a === b
}

/** Other node keys an applied `set` moves too (e.g. keys mapped from the same tracker field). */
export type ImpliedSets = (change: Extract<VertoChange, { type: 'set' }>) => Array<{ key: string; value: unknown }>

/**
 * Apply the draft to a graph, in order, each change against the graph with the earlier ones applied
 * (pure: changed nodes are copied). Only ticket nodes (including new ones) can be changed.
 */
export function applyChanges(
  graph: VertoGraph,
  changes: VertoChange[],
  implied?: ImpliedSets,
): { graph: VertoGraph; states: ChangeState[] } {
  const byId = new Map(graph.nodes.map(n => [n.id, n]))
  const order = graph.nodes.map(n => n.id)
  let edges: VertoEdge[] = graph.edges
  const ticket = (id: string): VertoNode | undefined => {
    const n = byId.get(id)
    return n?.nodeType === 'ticket' ? n : undefined
  }
  const put = (n: VertoNode) => {
    if (!byId.has(n.id)) order.push(n.id)
    byId.set(n.id, n)
  }

  const states = changes.map((c): ChangeState => {
    if (c.type === 'set') {
      const node = ticket(c.nodeId)
      if (!node) return 'notLoaded'
      const value = c.key === 'priority' ? clampPriority(c.value as number) : c.value
      if (sameValue(c.key, node[c.key], value)) return 'noop'
      const also = Object.fromEntries((implied?.(c) ?? []).map(s => [s.key, s.value]))
      put({ ...node, ...also, [c.key]: c.key === 'personas' ? [...(value as string[])] : value })
      return 'applied'
    }

    if (c.type === 'link') {
      const node = ticket(c.nodeId)
      if (!node || !ticket(c.blockerId)) return 'notLoaded'
      const isEdge = (e: VertoEdge) => e.reason === 'blocking' && e.from === c.blockerId && e.to === c.nodeId
      const has = edges.some(isEdge)
      if (has === c.add) return 'noop'
      if (c.add) {
        edges = [...edges, { from: c.blockerId, to: c.nodeId, reason: 'blocking' }]
        if (!node.prereqIds.includes(c.blockerId)) put({ ...node, prereqIds: [...node.prereqIds, c.blockerId] })
      } else {
        edges = edges.filter(e => !isEdge(e))
        const stillPrereq = node.childIds.includes(c.blockerId) || node._rawReqIds.includes(c.blockerId)
        if (!stillPrereq) put({ ...node, prereqIds: node.prereqIds.filter(id => id !== c.blockerId) })
      }
      return 'applied'
    }

    const parent = ticket(c.parentId)
    if (!parent || byId.has(c.nodeId)) return 'notLoaded'
    put({
      id: c.nodeId,
      title: c.title,
      isDone: false,
      isDeliverySlice: false,
      priority: 5,
      prereqIds: [],
      childIds: [],
      personas: [],
      _rawReqIds: [],
      nodeType: 'ticket',
      nodeOrigin: parent.nodeOrigin,
      ticketUrl: `${DRAFT_URL_SCHEME}${c.nodeId}`,
    })
    put({ ...parent, childIds: [...parent.childIds, c.nodeId], prereqIds: [...parent.prereqIds, c.nodeId] })
    edges = [...edges, { from: c.nodeId, to: c.parentId, reason: 'parent-child' }]
    return 'applied'
  })

  return { graph: { nodes: order.map(id => byId.get(id)!), edges }, states }
}

const isString = (v: unknown): v is string => typeof v === 'string'

function validSetValue(key: EditableKey, v: unknown): boolean {
  switch (key) {
    case 'title':
    case 'status': return isString(v)
    case 'priority': return typeof v === 'number' && Number.isFinite(v)
    case 'isDone': return typeof v === 'boolean'
    case 'personas': return Array.isArray(v) && v.every(isString)
  }
}

/** A well-formed change (shape and value types), or null. For input from the webview. */
export function parseChange(x: unknown): VertoChange | null {
  if (x === null || typeof x !== 'object') return null
  const o = x as Record<string, unknown>
  if (!isString(o.nodeId) || o.nodeId === '') return null
  if (o.type === 'set') {
    if (!isString(o.key) || !(EDITABLE_KEYS as readonly string[]).includes(o.key)) return null
    const key = o.key as EditableKey
    if (!validSetValue(key, o.value)) return null
    const value = o.value as string | number | boolean | string[]
    return { type: 'set', nodeId: o.nodeId, key, value: Array.isArray(value) ? [...value] : value }
  }
  if (o.type === 'link') {
    if (!isString(o.blockerId) || o.blockerId === '' || typeof o.add !== 'boolean') return null
    return { type: 'link', nodeId: o.nodeId, blockerId: o.blockerId, add: o.add }
  }
  if (o.type === 'create') {
    if (!isString(o.parentId) || o.parentId === '' || !isString(o.title)) return null
    return { type: 'create', nodeId: o.nodeId, parentId: o.parentId, title: o.title }
  }
  return null
}
