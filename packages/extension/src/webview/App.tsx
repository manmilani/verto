import React, { useRef } from 'react'
import { useVertoState } from './hooks/useVertoState.js'
import { DeliveryMap } from './lenses/DeliveryMap.js'
import { NcnLens } from './lenses/NcnLens.js'
import { JourneysLens } from './lenses/JourneysLens.js'
import { vscode } from './vscodeApi.js'
import { EditingContext } from './editing.js'
import { DraftBar } from './components/DraftBar.js'
import { FindBar } from './find/FindBar.js'

export default function App() {
  const {
    status, isRefreshing, bundle, displayStatusGroups, showOthersColumn, displayStatusGroupTooltips, parsedEnabled,
    projectName,
    lens, focusedNode, errorMessage, setupRequired,
    ncnFocusedNodeId,
    priorityOptionHints, statusOptions, writableLevels, draft, ncnTableView, showLosingPriorityChains,
    setLens, setFocusedNode, setParsedEnabled,
    edit, discard, writeBack, setNcnFocusedNodeId, focusInNcn, setNcnTableView,
  } = useVertoState()
  const searchRoot = useRef<HTMLDivElement>(null)

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
        <div style={{ display: 'flex', gap: 8 }}>
          {setupRequired && (
            <button
              style={buttonStyle}
              onClick={() => vscode.postMessage({ type: 'runSetup' })}
            >
              Setup
            </button>
          )}
          <button
            style={buttonStyle}
            onClick={() => vscode.postMessage({ type: 'retry' })}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!bundle) return null

  return (
    <EditingContext.Provider value={{ draft, statusOptions, writableLevels, priorityOptionHints, edit, discard, writeBack }}>
    <div ref={searchRoot} style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
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
        <button
          style={{ ...pillStyle, ...(lens === 'journeys' ? pillActiveStyle : {}) }}
          onClick={() => setLens('journeys')}
        >
          Journeys
        </button>
        <div style={{ flex: 1 }} />
        <DraftBar />
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
        {lens === 'ncnGraph' ? (
          <NcnLens
            bundle={bundle}
            displayStatusGroups={displayStatusGroups}
            showOthersColumn={showOthersColumn}
            displayStatusGroupTooltips={displayStatusGroupTooltips}
            projectName={projectName}
            tableView={ncnTableView}
            onTableViewChange={setNcnTableView}
            showLosingPriorityChains={showLosingPriorityChains}
            focusedNcnNodeId={ncnFocusedNodeId}
            onFocusNode={setNcnFocusedNodeId}
          />
        ) : lens === 'journeys' ? (
          <JourneysLens bundle={bundle} onFocusJourney={focusInNcn} />
        ) : (
          <DeliveryMap
            bundle={bundle}
            displayStatusGroups={displayStatusGroups}
            showOthersColumn={showOthersColumn}
            displayStatusGroupTooltips={displayStatusGroupTooltips}
            projectName={projectName}
            focusedNode={focusedNode}
            setFocusedNode={setFocusedNode}
            onFocusNcnNode={setNcnFocusedNodeId}
          />
        )}
      </div>
    </div>
    <FindBar root={searchRoot} />
    </EditingContext.Provider>
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
