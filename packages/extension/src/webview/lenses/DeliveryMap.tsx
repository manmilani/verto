import React from 'react'
import type { DeliveryMapBundle } from '@verto/core'
import { nodeWeight } from '@verto/core'
import type { PortfolioColumn } from '@verto/config'
import { buildPipelineForSlice } from '../pipelineRows.js'
import { assignPortfolioColumn, isGap } from '../portfolioMatch.js'
import { statusColor, statusLabel, CHART_COLORS } from '../theme.js'

interface Props {
  bundle: DeliveryMapBundle
  portfolioColumns: PortfolioColumn[]
  focusedNode: string | undefined
  setFocusedNode: (id: string | undefined) => void
}

export function DeliveryMap({ bundle, portfolioColumns, focusedNode, setFocusedNode }: Props) {
  const { graph } = bundle
  const implOrder = bundle.implementationOrder ?? []

  const slices = [...graph.nodes.filter(n => n.isDeliverySlice)].sort(
    (a, b) =>
      (bundle.deliveryCompleteness?.[b.id] ?? 0) -
      (bundle.deliveryCompleteness?.[a.id] ?? 0),
  )

  if (slices.length === 0) {
    return (
      <div style={emptyStyle}>No delivery slices found.</div>
    )
  }

  const slice = graph.nodes.find(n => n.id === focusedNode) ?? slices[0]
  const pipeline = buildPipelineForSlice(slice.id, graph, implOrder)
  const allColumns = [...portfolioColumns.map(c => c.label), 'Other']

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Slice pill selector */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {slices.map(s => {
          const active = s.id === slice.id
          return (
            <button
              key={s.id}
              onClick={() => setFocusedNode(s.id)}
              style={{
                ...slicePillStyle,
                background: active ? 'var(--vscode-button-background)' : 'var(--vscode-editor-background)',
                color: active ? 'var(--vscode-button-foreground)' : 'var(--vscode-foreground)',
                borderColor: active ? 'transparent' : 'var(--vscode-panel-border)',
              }}
            >
              {s.title}
            </button>
          )
        })}
      </div>

      {/* Slice header */}
      <div>
        {slice.personas && slice.personas.length > 0 && (
          <div style={{ fontSize: 12, color: 'var(--vscode-descriptionForeground)', marginBottom: 4 }}>
            {slice.personas.join(', ')}
          </div>
        )}
        <h2 style={{ margin: 0, fontSize: 16, color: 'var(--vscode-foreground)' }}>
          {slice.title}
        </h2>
        {slice._outcome && (
          <div style={{ marginTop: 6, fontSize: 13, color: 'var(--vscode-descriptionForeground)', fontStyle: 'italic' }}>
            {slice._outcome}
          </div>
        )}
      </div>

      {/* UsageBar — focused slice */}
      <UsageBar pipeline={pipeline} portfolioColumns={portfolioColumns} />

      {/* Gap callouts — focused slice */}
      <GapCallouts pipeline={pipeline} portfolioColumns={portfolioColumns} />

      {/* Pipeline */}
      <section>
        <h3 style={sectionHeadingStyle}>Pipeline</h3>
        {pipeline.length === 0 ? (
          <div style={emptyStyle}>No pipeline items.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pipeline.map(row => {
              const pct = row.nodeType === 'parsed'
                ? (row.isDone ? 100 : 0)
                : Math.round((bundle.deliveryCompleteness?.[row.id] ?? 0) * 100)
              return (
                <div key={row.id} style={pipelineRowStyle}>
                  <span
                    style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: statusColor(row.status),
                      flexShrink: 0, marginTop: 2,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: 'var(--vscode-foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.title}
                    </div>
                    {row._note && (
                      <div style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)', marginTop: 1 }}>
                        {row._note}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)', whiteSpace: 'nowrap' }}>
                    {statusLabel(row.status)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)', whiteSpace: 'nowrap', minWidth: 32, textAlign: 'right' }}>
                    {pct}%
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Portfolio table — all slices */}
      <section>
        <h3 style={sectionHeadingStyle}>Portfolio</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={thStyle}>Slice</th>
                {allColumns.map(col => (
                  <th key={col} style={{ ...thStyle, textAlign: 'right' }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slices.map(s => {
                const rows = buildPipelineForSlice(s.id, graph, implOrder)
                const counts: Record<string, number> = {}
                for (const col of allColumns) counts[col] = 0
                for (const row of rows) {
                  const col = assignPortfolioColumn(row, portfolioColumns)
                  counts[col] = (counts[col] ?? 0) + 1
                }
                const active = s.id === slice.id
                return (
                  <tr key={s.id} style={{ background: active ? 'var(--vscode-list-activeSelectionBackground)' : undefined }}>
                    <td style={tdStyle}>
                      <button
                        onClick={() => setFocusedNode(s.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--vscode-foreground)', cursor: 'pointer', fontSize: 12, padding: 0, textAlign: 'left' }}
                      >
                        {s.title}
                      </button>
                    </td>
                    {allColumns.map(col => (
                      <td key={col} style={{ ...tdStyle, textAlign: 'right' }}>
                        {counts[col] ?? 0}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function UsageBar({ pipeline, portfolioColumns }: { pipeline: ReturnType<typeof buildPipelineForSlice>, portfolioColumns: PortfolioColumn[] }) {
  const allColumns = [...portfolioColumns.map(c => c.label), 'Other']
  const weights: Record<string, number> = {}
  for (const col of allColumns) weights[col] = 0
  for (const row of pipeline) {
    const col = assignPortfolioColumn(row, portfolioColumns)
    weights[col] = (weights[col] ?? 0) + nodeWeight(row)
  }
  const total = Object.values(weights).reduce((a, b) => a + b, 0)
  if (total === 0) return null

  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)', marginBottom: 4 }}>Usage</div>
      <div style={{ display: 'flex', height: 12, borderRadius: 4, overflow: 'hidden', gap: 1 }}>
        {allColumns.map((col, i) => {
          const w = weights[col] ?? 0
          if (w === 0) return null
          return (
            <div
              key={col}
              title={`${col}: ${w}`}
              style={{
                flex: w / total,
                background: CHART_COLORS[i % CHART_COLORS.length],
                minWidth: 2,
              }}
            />
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
        {allColumns.map((col, i) => {
          const w = weights[col] ?? 0
          if (w === 0) return null
          return (
            <span key={col} style={{ fontSize: 10, color: 'var(--vscode-descriptionForeground)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: CHART_COLORS[i % CHART_COLORS.length], display: 'inline-block' }} />
              {col}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function GapCallouts({ pipeline, portfolioColumns }: { pipeline: ReturnType<typeof buildPipelineForSlice>, portfolioColumns: PortfolioColumn[] }) {
  const gaps = pipeline.filter(row => isGap(row, portfolioColumns))
  if (gaps.length === 0) return null
  return (
    <div style={{ borderLeft: '3px solid var(--vscode-charts-yellow)', paddingLeft: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--vscode-foreground)', marginBottom: 6 }}>
        Gaps ({gaps.length})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {gaps.map(row => (
          <div key={row.id} style={{ fontSize: 12, color: 'var(--vscode-descriptionForeground)' }}>
            {row.title}{row._note ? ` — ${row._note}` : ''}
          </div>
        ))}
      </div>
    </div>
  )
}

const emptyStyle: React.CSSProperties = {
  color: 'var(--vscode-descriptionForeground)',
  fontSize: 13,
  padding: 12,
}

const sectionHeadingStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--vscode-foreground)',
  margin: '0 0 8px 0',
}

const slicePillStyle: React.CSSProperties = {
  border: '1px solid',
  borderRadius: 14,
  padding: '4px 14px',
  cursor: 'pointer',
  fontSize: 12,
  display: 'inline-flex',
  alignItems: 'center',
}

const pipelineRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
  padding: '6px 8px',
  borderRadius: 4,
  background: 'var(--vscode-editor-background)',
}

const thStyle: React.CSSProperties = {
  padding: '4px 8px',
  textAlign: 'left',
  color: 'var(--vscode-descriptionForeground)',
  fontWeight: 600,
  borderBottom: '1px solid var(--vscode-panel-border)',
}

const tdStyle: React.CSSProperties = {
  padding: '4px 8px',
  borderBottom: '1px solid var(--vscode-panel-border)',
  color: 'var(--vscode-foreground)',
}
