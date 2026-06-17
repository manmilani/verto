import { useState, useEffect } from 'react'
import type { DeliveryMapBundle } from '@verto/core'
import type { DisplayStatusGroup } from '@verto/config'
import type {
  HostToWebviewMessage,
  WebviewToHostMessage,
  Lens,
  PersistedPanelState,
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
  parsedEnabled: boolean
  priorityOverlayActive: boolean
  lens: Lens
  focusedNode?: string
  ncnHighlightedSliceId?: string
  ncnFocusedNodeId?: string
  errorMessage?: string
}

export function useVertoState() {
  const [state, setState] = useState<VertoState>({
    status: 'loading',
    isRefreshing: false,
    displayStatusGroups: [],
    parsedEnabled: true,
    priorityOverlayActive: false,
    lens: 'deliveryMap',
  })

  useEffect(() => {
    const handler = (event: MessageEvent<HostToWebviewMessage>) => {
      const msg = event.data
      if (msg.type === 'loading') {
        setState(s => ({
          ...s,
          status: 'loading',
          // Only an incremental refresh if we already have data; otherwise full loading state
          isRefreshing: s.bundle !== undefined,
        }))
        return
      }
      if (msg.type === 'error') {
        setState(s => ({ ...s, status: 'error', isRefreshing: false, errorMessage: msg.message }))
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
          // This preserves focus/highlight across priority round-trips even when the
          // 'loading' → 'update' cycle temporarily clears s.status === 'ready'.
          const restoredHighlight = restored?.ncnHighlightedSliceId
          const restoredFocused = restored?.ncnFocusedNodeId

          const ncnHighlightedSliceId: string | undefined =
            (s.ncnHighlightedSliceId && sliceIds.has(s.ncnHighlightedSliceId))
              ? s.ncnHighlightedSliceId
              : (isFirstBundle && restoredHighlight && sliceIds.has(restoredHighlight))
                ? restoredHighlight
                : undefined

          const ncnFocusedNodeId: string | undefined =
            (s.ncnFocusedNodeId && nodeIds.has(s.ncnFocusedNodeId))
              ? s.ncnFocusedNodeId
              : (isFirstBundle && restoredFocused && nodeIds.has(restoredFocused))
                ? restoredFocused
                : undefined

          return {
            ...s,
            status: 'ready',
            isRefreshing: false,
            bundle: msg.bundle,
            displayStatusGroups: msg.displayStatusGroups,
            parsedEnabled: msg.parsedEnabled,
            priorityOverlayActive: msg.priorityOverlayActive,
            lens,
            focusedNode,
            ncnHighlightedSliceId,
            ncnFocusedNodeId,
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

  const setPriority = (sliceId: string, priority: number | null) => {
    vscode.postMessage({ type: 'setPriority', sliceId, priority } satisfies WebviewToHostMessage)
  }

  const setNcnHighlightedSliceId = (ncnHighlightedSliceId: string | undefined) => {
    setState(s => {
      const next = { ...s, ncnHighlightedSliceId }
      persistState(next)
      return next
    })
  }

  const setNcnFocusedNodeId = (ncnFocusedNodeId: string | undefined) => {
    setState(s => {
      const next = { ...s, ncnFocusedNodeId }
      persistState(next)
      return next
    })
  }

  return {
    ...state,
    setLens, setFocusedNode, setParsedEnabled,
    setPriority, setNcnHighlightedSliceId, setNcnFocusedNodeId,
  }
}

function persistState(s: VertoState) {
  const ps: PersistedPanelState = {
    lens: s.lens,
    focusedNode: s.focusedNode,
    ncnHighlightedSliceId: s.ncnHighlightedSliceId,
    ncnFocusedNodeId: s.ncnFocusedNodeId,
  }
  vscode.postMessage({ type: 'persistState', state: ps } satisfies WebviewToHostMessage)
}
