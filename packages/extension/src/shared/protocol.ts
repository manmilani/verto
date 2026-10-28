import type { ChangeState, DeliveryMapBundle, VertoChange } from '@verto/core'
import type { DisplayStatusGroup, PriorityOptionHints } from '@verto/config'

export type Lens = 'deliveryMap' | 'ncnGraph'

/** NCN bottom section: implementation-order table + priorities, or leverage-only table. */
export type NcnTableView = 'implementationOrder' | 'leverage'

export interface PersistedPanelState {
  lens: Lens
  focusedNode?: string
  ncnHighlightedSliceId?: string
  ncnFocusedNodeId?: string
  ncnTableView?: NcnTableView
}

export type WriteBackMode = 'draft' | 'immediate'

export interface DraftEntryView {
  change: VertoChange
  state: ChangeState
  error?: string
  label: string
}

/** The project's draft (DESIGN.md §4.6.11), in draft order. */
export interface DraftView {
  entries: DraftEntryView[]
  /** The adapter can write; otherwise the draft is a local preview. */
  canWrite: boolean
  mode: WriteBackMode
  writing: boolean
  adapter: string
}

export type HostToWebviewMessage =
  | { type: 'update'; bundle: DeliveryMapBundle; displayStatusGroups: DisplayStatusGroup[];
      showOthersColumn: boolean;
      displayStatusGroupTooltips: Record<string, string>;
      parsedEnabled: boolean; projectName: string;
      priorityOptionHints: PriorityOptionHints;
      statusOptions: string[];
      writableLevels: number[] | null;
      draft: DraftView;
      restoredState?: PersistedPanelState }
  | { type: 'loading' }
  | { type: 'error'; message: string; setupRequired?: boolean }

export type WebviewToHostMessage =
  | { type: 'ready' }
  | { type: 'setParsedEnabled'; enabled: boolean }
  | { type: 'persistState'; state: PersistedPanelState }
  /** A create's `nodeId` is ignored: the host assigns the temp id. */
  | { type: 'edit'; change: VertoChange }
  /** The changes to discard (matched by target); none = all. */
  | { type: 'discard'; changes?: VertoChange[] }
  | { type: 'writeBack' }
  | { type: 'retry' }
  | { type: 'runSetup' }
  | { type: 'openTicket'; url: string }
