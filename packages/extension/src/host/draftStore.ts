import type { VertoChange } from '@verto/core'
import { parseChange, sameTarget } from '@verto/core'
import type { VertoConfig } from '@verto/config'
import { adapterBlock } from '@verto/config'

const DRAFTS_KEY = 'verto.drafts'
const OLD_OVERLAY_KEY = 'verto.priorityOverlay'

/** A draft change with the error of its last failed write. */
export interface DraftEntry {
  change: VertoChange
  error?: string
}

/** The part of VS Code's `Memento` the store uses. */
export interface StateStore {
  get<T>(key: string): T | undefined
  update(key: string, value: unknown): Thenable<void>
}

function sorted(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sorted)
  if (v === null || typeof v !== 'object') return v
  return Object.fromEntries(Object.keys(v).sort().map(k => [k, sorted((v as Record<string, unknown>)[k])]))
}

/** A project's draft key: adapter id + its config block without `fieldMappings` (merged config). */
export function projectKey(config: VertoConfig): string {
  const { fieldMappings: _, ...block } = (adapterBlock(config) ?? {}) as Record<string, unknown>
  return JSON.stringify([config.adapter, sorted(block)])
}

/** One draft per project, in `workspaceState` (DESIGN.md §4.6.11). */
export class DraftStore {
  constructor(private readonly store: StateStore) {}

  private all(): Record<string, DraftEntry[]> {
    return this.store.get<Record<string, DraftEntry[]>>(DRAFTS_KEY) ?? {}
  }

  load(key: string): DraftEntry[] {
    const raw = this.all()[key]
    if (!Array.isArray(raw)) return []
    return raw.flatMap(e => {
      const change = parseChange(e?.change)
      if (!change) return []
      return [typeof e.error === 'string' ? { change, error: e.error } : { change }]
    })
  }

  async save(key: string, entries: DraftEntry[]): Promise<void> {
    const all = { ...this.all() }
    if (entries.length > 0) all[key] = entries
    else delete all[key]
    await this.store.update(DRAFTS_KEY, all)
  }

  /**
   * One-time move of the retired priority overlay into this project's draft, as `set priority` changes
   * for the ids in `graphIds` (the rest are dropped).
   */
  async migrateOverlay(key: string, graphIds: ReadonlySet<string>): Promise<void> {
    const overlay = this.store.get<Record<string, number | null>>(OLD_OVERLAY_KEY)
    if (overlay === undefined) return
    let entries = this.load(key)
    for (const [nodeId, value] of Object.entries(overlay ?? {})) {
      if (typeof value !== 'number' || !graphIds.has(nodeId)) continue
      const change: VertoChange = { type: 'set', nodeId, key: 'priority', value }
      const i = entries.findIndex(e => sameTarget(e.change, change))
      entries = i === -1 ? [...entries, { change }] : entries.map((e, j) => (j === i ? { change } : e))
    }
    await this.save(key, entries)
    await this.store.update(OLD_OVERLAY_KEY, undefined)
  }
}

function show(v: unknown): string {
  if (Array.isArray(v)) return v.length > 0 ? v.join(', ') : '(none)'
  return typeof v === 'string' ? JSON.stringify(v) : String(v)
}

/** A one-line description of a change for the draft list. */
export function changeLabel(c: VertoChange): string {
  if (c.type === 'link') return c.add ? `${c.blockerId} blocks ${c.nodeId}` : `${c.blockerId} no longer blocks ${c.nodeId}`
  if (c.type === 'create') return `${c.nodeId}: new child of ${c.parentId}, ${JSON.stringify(c.title)}`
  if (c.key === 'isDone') return `${c.nodeId} ${c.value ? 'done' : 'reopened'}`
  return `${c.nodeId} ${c.key} → ${show(c.value)}`
}
