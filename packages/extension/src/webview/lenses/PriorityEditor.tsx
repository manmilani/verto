import React, { useMemo, useState, useRef, useEffect } from 'react'
import type { DeliveryMapBundle, VertoNode } from '@verto/core'
import type { PriorityOptionHints } from '@verto/config/priority-hints'
import {
  allPriorityLevels,
  formatPriorityLevelCode,
  formatPriorityOptionHint,
  formatPriorityOptionLabel,
} from '@verto/config/priority-hints'
import {
  Stack, Row, Text, BorderedBox,
} from '../components/ui.js'

interface Props {
  bundle: DeliveryMapBundle
  priorityOverlayActive: boolean
  journeyPriorityOverlay: Record<string, number>
  priorityOptionHints: PriorityOptionHints
  onSetPriority: (sliceId: string, priority: number | null) => void
}

function compareSlicePriority(
  a: VertoNode,
  b: VertoNode,
  overlay: Record<string, number>,
): number {
  const pa = overlay[a.id] ?? Infinity
  const pb = overlay[b.id] ?? Infinity
  if (pa !== pb) return pa - pb
  if (a.priority !== b.priority) return a.priority - b.priority
  return a.title.localeCompare(b.title)
}

export function PriorityEditor({
  bundle, priorityOverlayActive, journeyPriorityOverlay, priorityOptionHints, onSetPriority,
}: Props) {
  const slices = useMemo(
    () => [...bundle.graph.nodes.filter(n => n.isDeliverySlice)]
      .sort((a, b) => compareSlicePriority(a, b, journeyPriorityOverlay)),
    [bundle, journeyPriorityOverlay],
  )

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
            No custom priorities set — every journey is weighted equally. Select a priority (1–9, lower = more important)
            for any journey to lift its closure.
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
              gap={10}
              align="center"
              style={{
                padding: '6px 10px',
                border: '1px solid var(--vscode-panel-border)',
                borderRadius: 8,
              }}
            >
              <PrioritySelect
                sliceId={s.id}
                overlayValue={journeyPriorityOverlay[s.id]}
                priorityOptionHints={priorityOptionHints}
                onSetPriority={onSetPriority}
              />
              <Text weight="semibold" style={{ flex: 1, minWidth: 0 }}>{s.title}</Text>
            </Row>
          ))}
        </Stack>
      </Stack>
    </BorderedBox>
  )
}

function PriorityOptionLabel({
  level,
  priorityOptionHints,
}: {
  level: number | null
  priorityOptionHints: PriorityOptionHints
}) {
  if (level === null) {
    return <Text as="span" tone="quaternary">—</Text>
  }
  const hint = formatPriorityOptionHint(level, priorityOptionHints)
  return (
    <>
      <Text as="span">{formatPriorityLevelCode(level)}</Text>
      {hint !== undefined && (
        <Text as="span" tone="quaternary"> ({hint})</Text>
      )}
    </>
  )
}

function PrioritySelect({
  sliceId,
  overlayValue,
  priorityOptionHints,
  onSetPriority,
}: {
  sliceId: string
  overlayValue?: number
  priorityOptionHints: PriorityOptionHints
  onSetPriority: (sliceId: string, priority: number | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [hoveredOption, setHoveredOption] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) {
      setHoveredOption(null)
      return
    }
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function choose(value: number | null) {
    onSetPriority(sliceId, value)
    setOpen(false)
  }

  return (
    <div ref={rootRef} style={{ position: 'relative', flexShrink: 0, minWidth: 168 }}>
      <button
        type="button"
        title="Priority 1–9 (lower = more important); — = not prioritised"
        style={triggerStyle}
        onClick={() => setOpen(v => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <PriorityOptionLabel
          level={overlayValue ?? null}
          priorityOptionHints={priorityOptionHints}
        />
        <span style={{ marginLeft: 8, opacity: 0.6 }} aria-hidden>▾</span>
      </button>

      {open && (
        <div
          role="listbox"
          style={menuStyle}
          onMouseLeave={() => setHoveredOption(null)}
        >
          <button
            type="button"
            role="option"
            aria-selected={overlayValue === undefined}
            style={optionStyle(overlayValue === undefined, hoveredOption === 'none')}
            onMouseEnter={() => setHoveredOption('none')}
            onClick={() => choose(null)}
          >
            <Text as="span" tone="quaternary">—</Text>
          </button>
          {allPriorityLevels().map(level => {
            const key = String(level)
            return (
              <button
                key={level}
                type="button"
                role="option"
                aria-selected={overlayValue === level}
                style={optionStyle(overlayValue === level, hoveredOption === key)}
                onMouseEnter={() => setHoveredOption(key)}
                onClick={() => choose(level)}
                title={formatPriorityOptionLabel(level, priorityOptionHints)}
              >
                <PriorityOptionLabel level={level} priorityOptionHints={priorityOptionHints} />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

const triggerStyle: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  fontSize: 12,
  padding: '4px 8px',
  background: 'var(--vscode-dropdown-background)',
  color: 'var(--vscode-dropdown-foreground)',
  border: '1px solid var(--vscode-dropdown-border)',
  borderRadius: 4,
  cursor: 'pointer',
  textAlign: 'left',
}

const menuStyle: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 2px)',
  left: 0,
  zIndex: 20,
  minWidth: '100%',
  maxHeight: 280,
  overflowY: 'auto',
  background: 'var(--vscode-dropdown-background)',
  border: '1px solid var(--vscode-dropdown-border)',
  borderRadius: 4,
  boxShadow: '0 4px 12px color-mix(in srgb, var(--vscode-widget-shadow) 40%, transparent)',
}

function optionStyle(isSelected: boolean, isHovered: boolean): React.CSSProperties {
  return {
    display: 'block',
    width: '100%',
    padding: '6px 10px',
    fontSize: 12,
    textAlign: 'left',
    border: 'none',
    background: isHovered
      ? 'var(--vscode-list-hoverBackground)'
      : isSelected
        ? 'color-mix(in srgb, var(--vscode-list-activeSelectionBackground) 28%, var(--vscode-editor-background))'
        : 'transparent',
    color: 'var(--vscode-dropdown-foreground)',
    cursor: 'pointer',
  }
}
