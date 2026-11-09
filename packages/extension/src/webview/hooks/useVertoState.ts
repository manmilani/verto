import { useState, useEffect } from 'react'
import type { DeliveryMapBundle, VertoChange } from '@verto/core'
import type { DisplayStatusGroup, PriorityOptionHints } from '@verto/config'
import type {
  HostToWebviewMessage,
  WebviewToHostMessage,
  Lens,
  NcnTableView,
  PersistedPanelState,
  DraftView,
  MoveResult,
} from '../../shared/protocol.js'
import { vscode } from '../vscodeApi.js'

function defaultFocusedNode(bundle: DeliveryMapBundle): string | undefined {
  const slices = bundle.graph.nodes.filter(n => n.isDeliverySlice)
  if (!slices.length) return undefined
  return [...slices].sort(
    (a, b) =>
      (bundle.deliveryCompleteness?.[b.id] ?? 0) -
      (bundle.deliveryCompleteness?.[a.id] ?? 0),
  )[0].id
}

interface VertoState {
  status: 'loading' | 'ready' | 'error'
  /** True when a refresh is in-flight but we already have bundle data to show */
  isRefreshing: boolean
  bundle?: DeliveryMapBundle
  displayStatusGroups: DisplayStatusGroup[]
  showOthersColumn: boolean
  displayStatusGroupTooltips: Record<string, string>
  parsedEnabled: boolean
  priorityOptionHints: PriorityOptionHints
  statusOptions: string[]
  writableLevels: number[] | null
  showLosingPriorityChains: boolean
  draft: DraftView
  projectName: string
  lens: Lens
  focusedNode?: string
  ncnFocusedNodeId?: string
  ncnTableView: NcnTableView
  /** Set while a dropped row waits for the host's `moveResult`. */
  moving: boolean
  moveResult?: MoveResult
  /** The order when `moveResult` arrived: a result without edits is dropped once the order changes. */
  moveOrder?: string
  errorMessage?: string
  setupRequired?: boolean
}

export function useVertoState() {
  const [state, setState] = useState<VertoState>({
    status: 'loading',
    isRefreshing: false,
    displayStatusGroups: [],
    showOthersColumn: false,
    displayStatusGroupTooltips: {},
    parsedEnabled: true,
    priorityOptionHints: {},
    statusOptions: [],
    writableLevels: null,
    showLosingPriorityChains: false,
    draft: { entries: [], canWrite: false, mode: 'draft', writing: false, adapter: '' },
    projectName: 'Verto',
    lens: 'deliveryMap',
    ncnTableView: 'leverage',
    moving: false,
  })

  useEffect(() => {
    const handler = (event: MessageEvent<HostToWebviewMessage>) => {
      const msg = event.data
      if (msg.type === 'loading') {
        setState(s => ({
          ...s,
          // Keep status 'ready' during incremental refresh so existing content stays visible;
          // only drop to 'loading' on the initial fetch when there's no data yet.
          status: s.bundle !== undefined ? 'ready' : 'loading',
          isRefreshing: s.bundle !== undefined,
        }))
        return
      }
      if (msg.type === 'error') {
        setState(s => ({
          ...s,
          status: 'error',
          isRefreshing: false,
          errorMessage: msg.message,
          setupRequired: msg.setupRequired === true,
        }))
        return
      }
      if (msg.type === 'moveResult') {
        setState(s => ({ ...s, moving: false, moveResult: msg, moveOrder: orderKey(s.bundle) }))
        return
      }
      if (msg.type === 'update') {
        const restored = msg.restoredState
        setState(s => {
          const nodeIds = new Set(msg.bundle.graph.nodes.map(n => n.id))
          const sliceIds = new Set(
            msg.bundle.graph.nodes.filter(n => n.isDeliverySlice).map(n => n.id),
          )
          const isFirstBundle = s.bundle === undefined

          // Delivery Map focused slice
          const currentIsValid = Boolean(s.focusedNode && sliceIds.has(s.focusedNode))
          const restoredIsValid = Boolean(
            restored?.focusedNode && sliceIds.has(restored.focusedNode),
          )
          const focusedNode: string | undefined =
            currentIsValid ? s.focusedNode :
            restoredIsValid ? restored!.focusedNode :
            defaultFocusedNode(msg.bundle)

          const lens: Lens =
            s.bundle !== undefined ? s.lens : (restored?.lens ?? s.lens)

          // NCN state: prefer valid in-memory value; restore from workspace only on first bundle.
          // This preserves focus across priority round-trips even when the
          // 'loading' → 'update' cycle temporarily clears s.status === 'ready'.
          const restoredFocused = restored?.ncnFocusedNodeId

          const ncnFocusedNodeId: string | undefined =
            (s.ncnFocusedNodeId && nodeIds.has(s.ncnFocusedNodeId))
              ? s.ncnFocusedNodeId
              : (isFirstBundle && restoredFocused && nodeIds.has(restoredFocused))
                ? restoredFocused
                : undefined

          const ncnTableView: NcnTableView =
            s.bundle !== undefined ? s.ncnTableView : (restored?.ncnTableView ?? 'leverage')

          const staleMove = !s.moveResult?.plan?.edits.length && orderKey(msg.bundle) !== s.moveOrder

          return {
            ...s,
            status: 'ready',
            isRefreshing: false,
            bundle: msg.bundle,
            displayStatusGroups: msg.displayStatusGroups,
            showOthersColumn: msg.showOthersColumn,
            displayStatusGroupTooltips: msg.displayStatusGroupTooltips,
            parsedEnabled: msg.parsedEnabled,
            priorityOptionHints: msg.priorityOptionHints,
            statusOptions: msg.statusOptions,
            writableLevels: msg.writableLevels,
            showLosingPriorityChains: msg.showLosingPriorityChains,
            draft: msg.draft,
            projectName: msg.projectName,
            lens,
            focusedNode,
            ncnFocusedNodeId,
            ncnTableView,
            ...(staleMove ? { moveResult: undefined } : undefined),
          }
        })
      }
    }
    window.addEventListener('message', handler)
    vscode.postMessage({ type: 'ready' } satisfies WebviewToHostMessage)
    return () => window.removeEventListener('message', handler)
  }, [])

  const setLens = (lens: Lens) => {
    setState(s => {
      const next = { ...s, lens }
      persistState(next)
      return next
    })
  }

  const setFocusedNode = (focusedNode: string | undefined) => {
    setState(s => {
      const next = { ...s, focusedNode }
      persistState(next)
      return next
    })
  }

  const setParsedEnabled = (enabled: boolean) => {
    vscode.postMessage({ type: 'setParsedEnabled', enabled } satisfies WebviewToHostMessage)
  }

  const edit = (change: VertoChange) => {
    vscode.postMessage({ type: 'edit', change } satisfies WebviewToHostMessage)
  }

  const discard = (changes?: VertoChange[]) => {
    vscode.postMessage({ type: 'discard', changes } satisfies WebviewToHostMessage)
  }

  const writeBack = () => {
    vscode.postMessage({ type: 'writeBack' } satisfies WebviewToHostMessage)
  }

  const move = (id: string, afterId?: string) => {
    setState(s => ({ ...s, moving: true }))
    vscode.postMessage({ type: 'move', id, afterId } satisfies WebviewToHostMessage)
  }

  const setNcnFocusedNodeId = (ncnFocusedNodeId: string | undefined) => {
    setState(s => {
      const next = { ...s, ncnFocusedNodeId }
      persistState(next)
      return next
    })
  }

  const focusInNcn = (ncnFocusedNodeId: string) => {
    setState(s => {
      const next: VertoState = { ...s, ncnFocusedNodeId, lens: 'ncnGraph' }
      persistState(next)
      return next
    })
  }

  const setNcnTableView = (ncnTableView: NcnTableView) => {
    setState(s => {
      const next = { ...s, ncnTableView }
      persistState(next)
      return next
    })
  }

  return {
    ...state,
    setLens, setFocusedNode, setParsedEnabled,
    edit, discard, writeBack, move, setNcnFocusedNodeId, focusInNcn, setNcnTableView,
  }
}

function orderKey(bundle: DeliveryMapBundle | undefined): string {
  return (bundle?.implementationOrder ?? []).join('\n')
}

function persistState(s: VertoState) {
  const ps: PersistedPanelState = {
    lens: s.lens,
    focusedNode: s.focusedNode,
    ncnFocusedNodeId: s.ncnFocusedNodeId,
    ncnTableView: s.ncnTableView,
  }
  vscode.postMessage({ type: 'persistState', state: ps } satisfies WebviewToHostMessage)
}
