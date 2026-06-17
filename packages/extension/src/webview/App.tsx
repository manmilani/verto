import React from 'react'
import { useVertoState } from './hooks/useVertoState.js'
import { DeliveryMap } from './lenses/DeliveryMap.js'
import { NcnGraph } from './lenses/NcnGraph.js'
import { ImplementationOrderTable } from './lenses/ImplementationOrderTable.js'
import { PriorityEditor } from './lenses/PriorityEditor.js'
import { FocusedNodeDetail } from './lenses/FocusedNodeDetail.js'
import { vscode } from './vscodeApi.js'

export default function App() {
  const {
    status, isRefreshing, bundle, displayStatusGroups, parsedEnabled,
    priorityOverlayActive,
    lens, focusedNode, errorMessage,
    ncnHighlightedSliceId, ncnFocusedNodeId,
    setLens, setFocusedNode, setParsedEnabled,
    setPriority, setNcnHighlightedSliceId, setNcnFocusedNodeId,
  } = useVertoState()

  // Full-screen loading only on initial load (no data yet)
  if (status === 'loading' && !bundle) {
    return (
      <div style={{ padding: 24, color: 'var(--vscode-foreground)' }}>
        Loading Verto data…
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div style={{ padding: 24, color: 'var(--vscode-foreground)' }}>
        <div style={{ color: 'var(--vscode-errorForeground)', marginBottom: 12 }}>
          {errorMessage ?? 'An error occurred.'}
        </div>
        <button
          style={buttonStyle}
          onClick={() => vscode.postMessage({ type: 'retry' })}
        >
          Retry
        </button>
      </div>
    )
  }

  if (!bundle) return null

  const focusedNcnNode = ncnFocusedNodeId
    ? bundle.graph.nodes.find(n => n.id === ncnFocusedNodeId)
    : undefined

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid var(--vscode-panel-border)', flexShrink: 0 }}>
        <button
          style={{ ...pillStyle, ...(lens === 'deliveryMap' ? pillActiveStyle : {}) }}
          onClick={() => setLens('deliveryMap')}
        >
          Delivery Map
        </button>
        <button
          style={{ ...pillStyle, ...(lens === 'ncnGraph' ? pillActiveStyle : {}) }}
          onClick={() => setLens('ncnGraph')}
        >
          NCN Graph
        </button>
        <div style={{ flex: 1 }} />
        {isRefreshing && (
          <span style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)' }}>
            Refreshing…
          </span>
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--vscode-foreground)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={parsedEnabled}
            onChange={e => setParsedEnabled(e.target.checked)}
          />
          Parsed Requirements
        </label>
      </div>

      {/* Lens content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {lens === 'deliveryMap' ? (
          <DeliveryMap
            bundle={bundle}
            displayStatusGroups={displayStatusGroups}
            focusedNode={focusedNode}
            setFocusedNode={setFocusedNode}
            onHighlightSlice={setNcnHighlightedSliceId}
          />
        ) : (
          /* NCN lens — two-column layout: sidebar + main area */
          <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
            {/* Left sidebar: Priority Editor */}
            <div style={{ width: 200, flexShrink: 0, borderRight: '1px solid var(--vscode-panel-border)', overflow: 'auto', padding: 8 }}>
              <PriorityEditor bundle={bundle} onSetPriority={setPriority} />
            </div>

            {/* Right area: graph + detail + table */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <NcnGraph
                bundle={bundle}
                displayStatusGroups={displayStatusGroups}
                priorityOverlayActive={priorityOverlayActive}
                highlightedSliceId={ncnHighlightedSliceId}
                focusedNcnNodeId={ncnFocusedNodeId}
                onFocusNode={setNcnFocusedNodeId}
                onHighlightSlice={setNcnHighlightedSliceId}
              />

              {focusedNcnNode && (
                <FocusedNodeDetail
                  node={focusedNcnNode}
                  bundle={bundle}
                  displayStatusGroups={displayStatusGroups}
                  onFocusNode={setNcnFocusedNodeId}
                />
              )}

              <div style={{ borderTop: '1px solid var(--vscode-panel-border)', overflow: 'auto', maxHeight: '40%' }}>
                <ImplementationOrderTable
                  bundle={bundle}
                  displayStatusGroups={displayStatusGroups}
                  priorityOverlayActive={priorityOverlayActive}
                  focusedNodeId={ncnFocusedNodeId}
                  onFocusNode={setNcnFocusedNodeId}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const buttonStyle: React.CSSProperties = {
  background: 'var(--vscode-button-background)',
  color: 'var(--vscode-button-foreground)',
  border: 'none',
  borderRadius: 4,
  padding: '4px 12px',
  cursor: 'pointer',
  fontSize: 13,
}

const pillStyle: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--vscode-foreground)',
  border: '1px solid var(--vscode-panel-border)',
  borderRadius: 12,
  padding: '3px 12px',
  cursor: 'pointer',
  fontSize: 12,
}

const pillActiveStyle: React.CSSProperties = {
  background: 'var(--vscode-button-background)',
  color: 'var(--vscode-button-foreground)',
  borderColor: 'transparent',
}
