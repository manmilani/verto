import React from 'react'
import type { DeliveryMapBundle, VertoNode } from '@verto/core'
import type { DisplayStatusGroup } from '@verto/config'
import { formatNodeStatus } from '../nodeStatusFormat.js'

interface Props {
  node: VertoNode
  bundle: DeliveryMapBundle
  displayStatusGroups: DisplayStatusGroup[]
  onFocusNode: (id: string | undefined) => void
}

export function FocusedNodeDetail({ node, bundle, displayStatusGroups, onFocusNode }: Props) {
  const { graph } = bundle
  const nodeById = new Map(graph.nodes.map(n => [n.id, n]))

  const prereqs = graph.edges
    .filter(e => e.to === node.id)
    .map(e => nodeById.get(e.from))
    .filter((n): n is VertoNode => Boolean(n))

  const dependents = graph.edges
    .filter(e => e.from === node.id)
    .map(e => nodeById.get(e.to))
    .filter((n): n is VertoNode => Boolean(n))

  const servedSliceTitles = (bundle.servedBySliceIds?.[node.id] ?? [])
    .map(sid => nodeById.get(sid)?.title ?? sid)

  return (
    <div style={panelStyle}>
      <div style={headerRowStyle}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={titleStyle}>
            {node.ticketUrl
              ? <a href={node.ticketUrl} target="_blank" rel="noreferrer" style={linkStyle}>{node.title}</a>
              : node.title}
          </div>
          <div style={statusStyle}>
            {formatNodeStatus(node, displayStatusGroups)}
          </div>
        </div>
        <button
          onClick={() => onFocusNode(undefined)}
          title="Dismiss"
          style={dismissStyle}
        >
          ×
        </button>
      </div>

      <div style={sectionRowStyle}>
        {prereqs.length > 0 && (
          <div style={sectionStyle}>
            <div style={sectionLabelStyle}>Depends on</div>
            <div style={pillRowStyle}>
              {prereqs.map(p => (
                <button
                  key={p.id}
                  onClick={() => onFocusNode(p.id)}
                  title={p.title}
                  style={pillStyle}
                >
                  {p.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {dependents.length > 0 && (
          <div style={sectionStyle}>
            <div style={sectionLabelStyle}>Unlocks</div>
            <div style={pillRowStyle}>
              {dependents.map(d => (
                <button
                  key={d.id}
                  onClick={() => onFocusNode(d.id)}
                  title={d.title}
                  style={pillStyle}
                >
                  {d.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {servedSliceTitles.length > 0 && (
          <div style={sectionStyle}>
            <div style={sectionLabelStyle}>Serves</div>
            <div style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)' }}>
              {servedSliceTitles.join(', ')}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const panelStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderTop: '1px solid var(--vscode-panel-border)',
  background: 'var(--vscode-editor-background)',
  flexShrink: 0,
}

const headerRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
  marginBottom: 8,
}

const titleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--vscode-foreground)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const statusStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--vscode-descriptionForeground)',
  marginTop: 2,
}

const dismissStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--vscode-foreground)',
  cursor: 'pointer',
  fontSize: 16,
  padding: '0 4px',
  flexShrink: 0,
  lineHeight: 1,
}

const sectionRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
}

const sectionStyle: React.CSSProperties = {
  minWidth: 120,
}

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: 'var(--vscode-descriptionForeground)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 4,
}

const pillRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 4,
}

const pillStyle: React.CSSProperties = {
  fontSize: 11,
  padding: '2px 8px',
  borderRadius: 10,
  border: '1px solid var(--vscode-panel-border)',
  background: 'var(--vscode-editor-background)',
  color: 'var(--vscode-foreground)',
  cursor: 'pointer',
  maxWidth: 160,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const linkStyle: React.CSSProperties = {
  color: 'inherit',
  textDecoration: 'none',
}
