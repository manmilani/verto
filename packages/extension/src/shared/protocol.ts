import type { DeliveryMapBundle } from '@verto/core'
import type { DisplayStatusGroup } from '@verto/config'

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

export type HostToWebviewMessage =
  | { type: 'update'; bundle: DeliveryMapBundle; displayStatusGroups: DisplayStatusGroup[];
      parsedEnabled: boolean; priorityOverlayActive: boolean; projectName: string;
      restoredState?: PersistedPanelState }
  | { type: 'loading' }
  | { type: 'error'; message: string }

export type WebviewToHostMessage =
  | { type: 'ready' }
  | { type: 'setParsedEnabled'; enabled: boolean }
  | { type: 'persistState'; state: PersistedPanelState }
  | { type: 'setPriority'; sliceId: string; priority: number | null }
  | { type: 'retry' }
