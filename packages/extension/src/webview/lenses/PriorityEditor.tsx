import React, { useState, useEffect } from 'react'
import type { DeliveryMapBundle, VertoNode } from '@verto/core'

interface Props {
  bundle: DeliveryMapBundle
  onSetPriority: (sliceId: string, priority: number | null) => void
}

export function PriorityEditor({ bundle, onSetPriority }: Props) {
  const slices = bundle.graph.nodes.filter(n => n.isDeliverySlice)

  if (slices.length === 0) return null

  return (
    <div>
      <div style={headerStyle}>Slice Priorities</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {slices.map(s => (
          <div key={s.id} style={rowStyle}>
            <div style={labelStyle} title={s.title}>{s.title}</div>
            <PriorityInput slice={s} onSetPriority={onSetPriority} />
          </div>
        ))}
      </div>
    </div>
  )
}

function PriorityInput({
  slice,
  onSetPriority,
}: {
  slice: VertoNode
  onSetPriority: (sliceId: string, priority: number | null) => void
}) {
  const [localValue, setLocalValue] = useState(String(slice.priority))

  // Re-sync when the host sends back a normalized/clamped value after a round-trip
  useEffect(() => {
    setLocalValue(String(slice.priority))
  }, [slice.priority])

  return (
    <input
      type="number"
      min={1}
      max={9}
      value={localValue}
      style={inputStyle}
      onChange={e => setLocalValue(e.target.value)}
      onBlur={e => {
        const raw = e.target.value.trim()
        if (raw === '') {
          onSetPriority(slice.id, null)
        } else {
          const parsed = parseInt(raw, 10)
          onSetPriority(slice.id, isNaN(parsed) ? null : parsed)
        }
      }}
    />
  )
}

const headerStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--vscode-descriptionForeground)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 8,
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
}

const labelStyle: React.CSSProperties = {
  flex: 1,
  fontSize: 11,
  color: 'var(--vscode-foreground)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const inputStyle: React.CSSProperties = {
  width: 36,
  fontSize: 11,
  padding: '2px 4px',
  background: 'var(--vscode-input-background)',
  color: 'var(--vscode-input-foreground)',
  border: '1px solid var(--vscode-input-border)',
  borderRadius: 3,
  flexShrink: 0,
}
