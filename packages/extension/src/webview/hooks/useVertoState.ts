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
  bundle?: DeliveryMapBundle
  displayStatusGroups: DisplayStatusGroup[]
  parsedEnabled: boolean
  lens: Lens
  focusedNode?: string
  errorMessage?: string
}

export function useVertoState() {
  const [state, setState] = useState<VertoState>({
    status: 'loading',
    displayStatusGroups: [],
    parsedEnabled: true,
    lens: 'deliveryMap',
  })

  useEffect(() => {
    const handler = (event: MessageEvent<HostToWebviewMessage>) => {
      const msg = event.data
      if (msg.type === 'loading') {
        setState(s => ({ ...s, status: 'loading' }))
        return
      }
      if (msg.type === 'error') {
        setState(s => ({ ...s, status: 'error', errorMessage: msg.message }))
        return
      }
      if (msg.type === 'update') {
        const restored = msg.restoredState
        setState(s => {
          const sliceIds = new Set(
            msg.bundle.graph.nodes.filter(n => n.isDeliverySlice).map(n => n.id),
          )
          const currentIsValid = Boolean(s.focusedNode && sliceIds.has(s.focusedNode))
          const restoredIsValid = Boolean(
            restored?.focusedNode && sliceIds.has(restored.focusedNode),
          )
          const focusedNode: string | undefined =
            currentIsValid ? s.focusedNode :
            restoredIsValid ? restored!.focusedNode :
            defaultFocusedNode(msg.bundle)

          const lens: Lens =
            s.status === 'ready' ? s.lens : (restored?.lens ?? s.lens)

          return {
            ...s,
            status: 'ready',
            bundle: msg.bundle,
            displayStatusGroups: msg.displayStatusGroups,
            parsedEnabled: msg.parsedEnabled,
            lens,
            focusedNode,
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

  return { ...state, setLens, setFocusedNode, setParsedEnabled }
}

function persistState(s: VertoState) {
  const ps: PersistedPanelState = { lens: s.lens, focusedNode: s.focusedNode }
  vscode.postMessage({ type: 'persistState', state: ps } satisfies WebviewToHostMessage)
}
