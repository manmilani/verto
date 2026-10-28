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
  Stack, Row, Text, BorderedBox, Pill,
} from '../components/ui.js'
import { isLevelDisabled, pendingSet, useEditing } from '../editing.js'

interface Props {
  bundle: DeliveryMapBundle
}

/** Journeys with a drafted priority first (by it), then by priority, then title. */
function compareSlicePriority(a: VertoNode, b: VertoNode, pending: Set<string>): number {
  const pa = pending.has(a.id) ? 0 : 1
  const pb = pending.has(b.id) ? 0 : 1
  if (pa !== pb) return pa - pb
  if (a.priority !== b.priority) return a.priority - b.priority
  return a.title.localeCompare(b.title)
}

export function PriorityEditor({ bundle }: Props) {
  const { draft, edit, discard } = useEditing()
  const pending = useMemo(
    () => new Set(draft.entries.flatMap(e => (e.change.type === 'set' && e.change.key === 'priority' ? [e.change.nodeId] : []))),
    [draft],
  )
  const slices = useMemo(
    () => [...bundle.graph.nodes.filter(n => n.isDeliverySlice)]
      .sort((a, b) => compareSlicePriority(a, b, pending)),
    [bundle, pending],
  )

  if (slices.length === 0) return null

  return (
    <BorderedBox>
      <Stack gap={10}>
        <Row gap={10} wrap align="flex-start">
          <Stack gap={2} style={{ flex: 1, minWidth: 240 }}>
            <Text weight="bold" style={{ fontSize: 16 }}>
              Journey priorities (market demand)
            </Text>
            <Text size="small" tone="tertiary">
              Rank the journeys that matter most to customers (1–9, lower = more important). Each journey lifts its
              entire dependency chain — its deliverables and everything they transitively need — and the table below
              turns into a build execution order that delivers those journeys fastest.
            </Text>
            <Text size="small" tone="quaternary">
              {draft.canWrite
                ? 'Priorities are written to the tickets (Write back, or right away in immediate mode). — discards a pending change.'
                : `${draft.adapter} write-back is not supported yet: priorities are kept as a local preview. — discards a pending change.`}
            </Text>
          </Stack>
        </Row>

        <Stack gap={6}>
          {slices.map(s => {
            const entry = pendingSet(draft, s.id, 'priority')
            return (
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
                  value={s.priority}
                  pending={Boolean(entry)}
                  disabled={draft.writing}
                  onChoose={level => {
                    if (level !== null) edit({ type: 'set', nodeId: s.id, key: 'priority', value: level })
                    else if (entry) discard([entry.change])
                  }}
                />
                <Text weight="semibold" style={{ flex: 1, minWidth: 0 }}>{s.title}</Text>
                {entry && <Pill size="sm" tone={entry.error ? 'danger' : 'info'} title={entry.error}>pending</Pill>}
              </Row>
            )
          })}
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

/**
 * A priority picker: `value` is the current priority (draft applied), `pending` marks a drafted one.
 * Choosing "—" (offered while pending) passes null. Levels the tracker can't hold are disabled.
 */
export function PrioritySelect({
  value,
  pending,
  disabled,
  onChoose,
}: {
  value: number
  pending: boolean
  disabled?: boolean
  onChoose: (level: number | null) => void
}) {
  const editing = useEditing()
  const { priorityOptionHints } = editing
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

  function choose(level: number | null) {
    onChoose(level)
    setOpen(false)
  }

  return (
    <div ref={rootRef} style={{ position: 'relative', flexShrink: 0, minWidth: 168 }}>
      <button
        type="button"
        title="Priority 1–9 (lower = more important)"
        style={{ ...triggerStyle, ...(pending ? { borderColor: 'var(--vscode-focusBorder)' } : {}), ...(disabled ? { opacity: 0.5, cursor: 'default' } : {}) }}
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>
          <PriorityOptionLabel level={value} priorityOptionHints={priorityOptionHints} />
          {pending && <Text as="span" tone="tertiary"> •</Text>}
        </span>
        <span style={{ marginLeft: 8, opacity: 0.6 }} aria-hidden>▾</span>
      </button>

      {open && (
        <div
          role="listbox"
          style={menuStyle}
          onMouseLeave={() => setHoveredOption(null)}
        >
          {pending && (
            <button
              type="button"
              role="option"
              aria-selected={false}
              title="Discard the pending priority"
              style={optionStyle(false, hoveredOption === 'none')}
              onMouseEnter={() => setHoveredOption('none')}
              onClick={() => choose(null)}
            >
              <Text as="span" tone="quaternary">—</Text>
            </button>
          )}
          {allPriorityLevels().map(level => {
            const key = String(level)
            const off = isLevelDisabled(editing, level)
            return (
              <button
                key={level}
                type="button"
                role="option"
                aria-selected={value === level}
                disabled={off}
                style={{ ...optionStyle(value === level, hoveredOption === key), ...(off ? { opacity: 0.4, cursor: 'default' } : {}) }}
                onMouseEnter={() => setHoveredOption(key)}
                onClick={() => choose(level)}
                title={off ? 'No tracker value reads back as this level' : formatPriorityOptionLabel(level, priorityOptionHints)}
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