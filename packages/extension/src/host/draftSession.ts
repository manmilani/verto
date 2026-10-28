import type { VertoChange, WriteResult } from '@verto/core'
import { changeNodeIds, nextTempId, remapNodeIds, sameTarget } from '@verto/core'
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
