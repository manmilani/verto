import type { DeliveryMapBundle } from '@verto/core'
import type { DisplayStatusGroup } from '@verto/config'

export type Lens = 'deliveryMap' | 'ncnGraph'

export interface PersistedPanelState {
  lens: Lens
  focusedNode?: string
}

export type HostToWebviewMessage =
  | { type: 'update'; bundle: DeliveryMapBundle; displayStatusGroups: DisplayStatusGroup[];
      parsedEnabled: boolean; restoredState?: PersistedPanelState }
  | { type: 'loading' }
  | { type: 'error'; message: string }

export type WebviewToHostMessage =
  | { type: 'ready' }
  | { type: 'setParsedEnabled'; enabled: boolean }
  | { type: 'persistState'; state: PersistedPanelState }
  | { type: 'retry' }
