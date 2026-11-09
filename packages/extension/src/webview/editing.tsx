import { createContext, useContext } from 'react'
import type { VertoChange } from '@verto/core'
import { changeNodeIds } from '@verto/core'
import type { PriorityOptionHints } from '@verto/config/priority-hints'
import type { DraftEntryView, DraftView, MoveResult } from '../shared/protocol.js'

/** The draft and edit actions (DESIGN.md §4.6.11), shared by every lens. */
export interface Editing {
  draft: DraftView
  statusOptions: string[]
  writableLevels: number[] | null
  priorityOptionHints: PriorityOptionHints
  edit(change: VertoChange): void
  discard(changes?: VertoChange[]): void
  writeBack(): void
  /** Drag-and-drop reorder (DESIGN.md §3.5); `moving` until the host's `moveResult` arrives. */
  move(id: string, afterId?: string): void
  moving: boolean
  moveResult?: MoveResult
}

export const EditingContext = createContext<Editing>({
  draft: { entries: [], canWrite: false, mode: 'draft', writing: false, adapter: '' },
  statusOptions: [],
  writableLevels: null,
  priorityOptionHints: {},
  edit: () => undefined,
  discard: () => undefined,
  writeBack: () => undefined,
  move: () => undefined,
  moving: false,
})

export function useEditing(): Editing {
  return useContext(EditingContext)
}

/** Draft entries that refer to a node. */
export function entriesFor(draft: DraftView, nodeId: string): DraftEntryView[] {
  return draft.entries.filter(e => changeNodeIds(e.change).includes(nodeId))
}

/** The draft's `set` of `key` on a node, if any. */
export function pendingSet(draft: DraftView, nodeId: string, key: string): DraftEntryView | undefined {
  return draft.entries.find(e => e.change.type === 'set' && e.change.nodeId === nodeId && e.change.key === key)
}

/** Levels that can't be written (only when the adapter writes and the mapping limits levels). */
export function isLevelDisabled(e: Pick<Editing, 'draft' | 'writableLevels'>, level: number): boolean {
  return e.draft.canWrite && e.writableLevels !== null && !e.writableLevels.includes(level)
}
