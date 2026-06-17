import React from 'react'
import { useVertoState } from './hooks/useVertoState.js'
import { DeliveryMap } from './lenses/DeliveryMap.js'
import { NcnLens } from './lenses/NcnLens.js'
import { vscode } from './vscodeApi.js'

export default function App() {
  const {
    status, isRefreshing, bundle, displayStatusGroups, parsedEnabled,
    projectName,
    lens, focusedNode, errorMessage,
    ncnHighlightedSliceId, ncnFocusedNodeId, priorityOverlayActive,
    setLens, setFocusedNode, setParsedEnabled,
    setPriority, setNcnHighlightedSliceId, setNcnFocusedNodeId,
  } = useVertoState()

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
        borderBottom: '1px solid var(--vscode-panel-border)', flexShrink: 0,
      }}>
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

      <div style={{ flex: 1, overflow: 'auto' }}>
        {lens === 'deliveryMap' ? (
          <DeliveryMap
            bundle={bundle}
            displayStatusGroups={displayStatusGroups}
            projectName={projectName}
            focusedNode={focusedNode}
            setFocusedNode={setFocusedNode}
            onHighlightSlice={setNcnHighlightedSliceId}
          />
        ) : (
          <NcnLens
            bundle={bundle}
            displayStatusGroups={displayStatusGroups}
            projectName={projectName}
            priorityOverlayActive={priorityOverlayActive}
            highlightedSliceId={ncnHighlightedSliceId}
            focusedNcnNodeId={ncnFocusedNodeId}
            onFocusNode={setNcnFocusedNodeId}
            onHighlightSlice={setNcnHighlightedSliceId}
            onSetPriority={setPriority}
          />
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
