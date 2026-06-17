import React, { useState, useEffect } from 'react'
import type { DeliveryMapBundle, VertoNode } from '@verto/core'
import {
  Stack, Row, Text, BorderedBox,
} from '../components/ui.js'

interface Props {
  bundle: DeliveryMapBundle
  priorityOverlayActive: boolean
  onSetPriority: (sliceId: string, priority: number | null) => void
}

export function PriorityEditor({ bundle, priorityOverlayActive, onSetPriority }: Props) {
  const slices = bundle.graph.nodes.filter(n => n.isDeliverySlice)

  if (slices.length === 0) return null

  return (
    <BorderedBox>
      <Stack gap={10}>
        <Row gap={10} wrap align="flex-start">
          <Stack gap={2} style={{ flex: 1, minWidth: 240 }}>
            <Text weight="bold" style={{ fontSize: 16 }}>
              Custom journey priorities (market demand)
            </Text>
            <Text size="small" tone="tertiary">
              Rank only the journeys that matter most to customers. Each prioritised journey lifts its entire dependency
              chain — its deliverables and everything they transitively need — and the list below turns into a build
              execution order that delivers those journeys fastest. Unlisted journeys stay at the same baseline.
            </Text>
          </Stack>
        </Row>

        {!priorityOverlayActive ? (
          <Text size="small" tone="quaternary">
            No custom priorities set — every journey is weighted equally, so the table below ranks purely by leverage.
            Enter a priority (1–9, lower = more important) for any journey to lift its closure.
          </Text>
        ) : (
          <Text size="small" tone="tertiary">
            Priorities active — the implementation order table reflects your prioritised journeys.
          </Text>
        )}

        <Stack gap={6}>
          {slices.map(s => (
            <Row
              key={s.id}
              gap={8}
              style={{
                padding: '6px 10px',
                border: '1px solid var(--vscode-panel-border)',
                borderRadius: 8,
              }}
            >
              <Text weight="semibold" style={{ flex: 1, minWidth: 0 }}>{s.title}</Text>
              <PriorityInput slice={s} onSetPriority={onSetPriority} />
            </Row>
          ))}
        </Stack>
      </Stack>
    </BorderedBox>
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

  useEffect(() => {
    setLocalValue(String(slice.priority))
  }, [slice.priority])

  return (
    <input
      type="number"
      min={1}
      max={9}
      placeholder="—"
      title="Priority 1–9 (lower = more important); clear to reset"
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

const inputStyle: React.CSSProperties = {
  width: 48,
  fontSize: 12,
  padding: '4px 6px',
  background: 'var(--vscode-input-background)',
  color: 'var(--vscode-input-foreground)',
  border: '1px solid var(--vscode-input-border)',
  borderRadius: 4,
  flexShrink: 0,
}
