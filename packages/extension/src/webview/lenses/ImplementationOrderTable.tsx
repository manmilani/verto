import React from 'react'
import type { DeliveryMapBundle } from '@verto/core'
import type { DisplayStatusGroup } from '@verto/config'
import { formatNodeStatus, formatPriority } from '../nodeStatusFormat.js'

interface Props {
  bundle: DeliveryMapBundle
  displayStatusGroups: DisplayStatusGroup[]
  priorityOverlayActive: boolean
  focusedNodeId?: string
  onFocusNode: (id: string | undefined) => void
}

export function ImplementationOrderTable({ bundle, displayStatusGroups, priorityOverlayActive, focusedNodeId, onFocusNode }: Props) {
  const { graph } = bundle
  const nodeById = new Map(graph.nodes.map(n => [n.id, n]))

  function nodeTitle(id: string): string {
    return nodeById.get(id)?.title ?? id
  }

  if (!priorityOverlayActive) {
    // Mode 1 — no overlay: "ready to start now" sorted by leverage
    const readyIds = [...(bundle.readyIds ?? [])].sort(
      (a, b) => (bundle.leverageScore?.[b] ?? 0) - (bundle.leverageScore?.[a] ?? 0),
    )

    return (
      <div style={containerStyle}>
        <div style={titleStyle}>Ready to start now — ranked by leverage</div>
        {readyIds.length === 0 ? (
          <div style={emptyStyle}>No ready items.</div>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Leverage</th>
                <th style={thStyle}>Title</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Unlocks</th>
                <th style={thStyle}>Serves</th>
              </tr>
            </thead>
            <tbody>
              {readyIds.map(id => {
                const node = nodeById.get(id)
                if (!node) return null
                const leverage = bundle.leverageScore?.[id] ?? 0
                const unlocks = graph.edges
                  .filter(e => e.from === id)
                  .map(e => nodeTitle(e.to))
                  .join(', ')
                const serves = (bundle.servedBySliceIds?.[id] ?? [])
                  .map(sid => nodeTitle(sid))
                  .join(', ')
                const isFocused = id === focusedNodeId
                return (
                  <tr
                    key={id}
                    onClick={() => onFocusNode(id)}
                    style={{
                      cursor: 'pointer',
                      background: isFocused ? 'var(--vscode-list-activeSelectionBackground)' : undefined,
                    }}
                  >
                    <td style={tdStyle}>{leverage}</td>
                    <td style={tdStyle}>
                      {node.ticketUrl
                        ? <a href={node.ticketUrl} target="_blank" rel="noreferrer" style={linkStyle} onClick={e => e.stopPropagation()}>{node.title}</a>
                        : node.title}
                    </td>
                    <td style={tdStyle}>{formatNodeStatus(node, displayStatusGroups)}</td>
                    <td style={{ ...tdStyle, color: 'var(--vscode-descriptionForeground)', fontSize: 11 }}>{unlocks || '—'}</td>
                    <td style={{ ...tdStyle, color: 'var(--vscode-descriptionForeground)', fontSize: 11 }}>{serves || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    )
  }

  // Mode 2 — overlay active: full implementation order, not-done only
  const orderIds = (bundle.implementationOrder ?? []).filter(
    id => !nodeById.get(id)?.isDone,
  )

  return (
    <div style={containerStyle}>
      <div style={titleStyle}>Implementation order</div>
      {orderIds.length === 0 ? (
        <div style={emptyStyle}>Nothing left to do.</div>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Priority</th>
              <th style={thStyle}>Title</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Leverage</th>
              <th style={thStyle}>Serves</th>
              <th style={thStyle}>Ready?</th>
            </tr>
          </thead>
          <tbody>
            {orderIds.map(id => {
              const node = nodeById.get(id)
              if (!node) return null
              const priority = formatPriority(bundle.globalPriorityRanking?.[id])
              const leverage = bundle.leverageScore?.[id] ?? 0
              const serves = (bundle.servedBySliceIds?.[id] ?? [])
                .map(sid => nodeTitle(sid))
                .join(', ')
              const isReady = bundle.readyIds?.includes(id) ?? false
              const isFocused = id === focusedNodeId
              return (
                <tr
                  key={id}
                  onClick={() => onFocusNode(id)}
                  style={{
                    cursor: 'pointer',
                    background: isFocused ? 'var(--vscode-list-activeSelectionBackground)' : undefined,
                  }}
                >
                  <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums' }}>{priority}</td>
                  <td style={tdStyle}>
                    {node.ticketUrl
                      ? <a href={node.ticketUrl} target="_blank" rel="noreferrer" style={linkStyle} onClick={e => e.stopPropagation()}>{node.title}</a>
                      : node.title}
                  </td>
                  <td style={tdStyle}>{formatNodeStatus(node, displayStatusGroups)}</td>
                  <td style={tdStyle}>{leverage}</td>
                  <td style={{ ...tdStyle, color: 'var(--vscode-descriptionForeground)', fontSize: 11 }}>{serves || '—'}</td>
                  <td style={{ ...tdStyle, color: isReady ? 'var(--vscode-charts-green)' : 'var(--vscode-descriptionForeground)' }}>
                    {isReady ? 'Ready' : 'Blocked'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

const containerStyle: React.CSSProperties = {
  padding: '8px 12px',
}

const titleStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--vscode-foreground)',
  marginBottom: 8,
}

const emptyStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--vscode-descriptionForeground)',
  padding: '4px 0',
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 12,
}

const thStyle: React.CSSProperties = {
  padding: '4px 8px',
  textAlign: 'left',
  color: 'var(--vscode-descriptionForeground)',
  fontWeight: 600,
  borderBottom: '1px solid var(--vscode-panel-border)',
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '4px 8px',
  borderBottom: '1px solid var(--vscode-panel-border)',
  color: 'var(--vscode-foreground)',
  verticalAlign: 'middle',
}

const linkStyle: React.CSSProperties = {
  color: 'var(--vscode-textLink-foreground)',
  textDecoration: 'none',
}
