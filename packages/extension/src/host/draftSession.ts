import type { MovePlan, VertoChange, WriteResult } from '@verto/core'
import { changeNodeIds, nextTempId, planMove, remapNodeIds, sameTarget } from '@verto/core'
import type { DraftEntry } from './draftStore.js'
import { buildView, type LoadedProject, type ProjectView } from './loadPipeline.js'

/** The adapter can write: edits are checked against the tracker and Write back is offered. */
export function canWrite(loaded: LoadedProject): boolean {
  return typeof loaded.adapter.writeBack === 'function'
}

/** The view with the draft, and the draft without its no-op changes (rule: no-ops disappear). */
export function viewWithDraft(
  loaded: LoadedProject,
  entries: DraftEntry[],
  parsedEnabled: boolean,
): { view: ProjectView; entries: DraftEntry[]; pruned: boolean } {
  const view = buildView(loaded, entries.map(e => e.change), parsedEnabled)
  const keep = view.changeStates.map(s => s.state !== 'noop')
  if (keep.every(Boolean)) return { view, entries, pruned: false }
  return {
    view: { ...view, changeStates: view.changeStates.filter((_, i) => keep[i]) },
    entries: entries.filter((_, i) => keep[i]),
    pruned: true,
  }
}

/** The first `invalid` entry's message, or null when the draft's preview validates. */
export function invalidReason(view: ProjectView): string | null {
  const s = view.changeStates.find(x => x.state === 'invalid')
  return s ? (s.error ?? 'the draft no longer validates') : null
}

/**
 * Accept an edit (DESIGN.md §4.6.11 rule 5): every node it refers to is a ticket node of the preview,
 * titles are non-empty, the adapter (when it can write) can write it, and the preview still validates.
 * A create gets the next temp id. The replaced change's error is dropped.
 */
export async function acceptEdit(
  loaded: LoadedProject,
  entries: DraftEntry[],
  input: VertoChange,
  parsedEnabled: boolean,
): Promise<{ ok: true; entries: DraftEntry[] } | { ok: false; error: string }> {
  const changes = entries.map(e => e.change)
  const change: VertoChange = input.type === 'create' ? { ...input, nodeId: nextTempId(changes) } : input
  const previewView = buildView(loaded, changes, parsedEnabled)
  const preview = previewView.bundle.graph
  const tickets = new Set(preview.nodes.filter(n => n.nodeType === 'ticket').map(n => n.id))
  const refs = changeNodeIds(change).filter(id => !(change.type === 'create' && id === change.nodeId))
  const unknown = refs.find(id => !tickets.has(id))
  if (unknown !== undefined) return { ok: false, error: `${unknown} is not a ticket in this view` }
  const title = change.type === 'create' ? change.title : change.type === 'set' && change.key === 'title' ? change.value : null
  if (typeof title === 'string' && title.trim() === '') return { ok: false, error: 'a title is required' }
  if (canWrite(loaded) && loaded.adapter.checkChange) {
    const error = await loaded.adapter.checkChange(loaded.fullConfig, change, changes)
    if (error) return { ok: false, error }
  }
  const i = entries.findIndex(e => sameTarget(e.change, change))
  const next = i === -1 ? [...entries, { change }] : entries.map((e, j) => (j === i ? { change } : e))
  let reason: string | null
  try {
    reason = invalidReason(buildView(loaded, next.map(e => e.change), parsedEnabled))
  } catch (e) {
    reason = e instanceof Error ? e.message : String(e)
  }
  if (!reason) return { ok: true, entries: next }
  const stale = invalidReason(previewView) ? 'the draft has invalid entries; discard them first: ' : ''
  return { ok: false, error: stale + reason }
}

/**
 * Plan dropping work-item `id` right below `afterId` (none = top) in the view's implementation order
 * (DESIGN.md §3.5). Only tickets are edited, to levels the tracker can hold when the adapter writes.
 * `target` = the 0-based row X would occupy at the drop.
 */
export function planDrop(
  view: ProjectView,
  writable: boolean,
  id: string,
  afterId?: string,
): { ok: true; target: number; plan: MovePlan } | { ok: false; error: string } {
  const order = view.bundle.implementationOrder ?? []
  const from = order.indexOf(id)
  if (from < 0) return { ok: false, error: `${id} is no longer in the implementation order` }
  const gap = afterId === undefined ? 0 : order.indexOf(afterId) + 1
  if (afterId !== undefined && gap === 0) return { ok: false, error: `${afterId} is no longer in the implementation order` }
  const levels = [1, 2, 3, 4, 5, 6, 7, 8, 9]
    .filter(l => !writable || view.writableLevels === null || view.writableLevels.includes(l))
  const plan = planMove(view.bundle.graph, id, gap, n => (n.nodeType === 'ticket' ? levels : []))
  return { ok: true, target: gap > from ? gap - 1 : gap, plan }
}

/**
 * The draft after a write: the failed changes (temp ids of written creates remapped), with their errors.
 * `shown` lists the errors that differ from the one already stored on that entry.
 */
export function afterWrite(entries: DraftEntry[], result: WriteResult): { entries: DraftEntry[]; shown: DraftEntry[] } {
  const shown: DraftEntry[] = []
  const kept = result.failed.map(({ change, error }) => {
    const before = entries.find(e => sameTarget(e.change, change))
    if (before?.error !== error) shown.push({ change, error })
    return { change: remapNodeIds([change], result.createdIds)[0]!, error }
  })
  return { entries: kept, shown }
}
