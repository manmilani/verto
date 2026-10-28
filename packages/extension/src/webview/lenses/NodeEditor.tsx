import React, { useEffect, useRef, useState } from 'react'
import type { DeliveryMapBundle, VertoNode } from '@verto/core'
import { Stack, Row, Text, Pill } from '../components/ui.js'
import { pendingSet, useEditing } from '../editing.js'
import { PrioritySelect } from './PriorityEditor.js'

/**
 * A text input that commits on Enter or blur (when changed, once per text); Escape restores the value.
 * Every view from the host restores it too unless the user typed since, so a refused edit doesn't linger.
 */
function CommitInput({
  value, placeholder, disabled, clearOnCommit, onCommit, style,
}: {
  value: string
  placeholder?: string
  disabled?: boolean
  clearOnCommit?: boolean
  onCommit: (value: string) => void
  style?: React.CSSProperties
}) {
  const { draft } = useEditing()
  const [text, setText] = useState(value)
  const shown = useRef(value)
  const committed = useRef<string | null>(null)
  useEffect(() => {
    const before = shown.current
    const sent = committed.current
    setText(t => (t === before || t === sent ? value : t))
    shown.current = value
    committed.current = null
  }, [value, draft])
  const commit = () => {
    if (text === value || text === committed.current) return
    committed.current = text
    onCommit(text)
    if (clearOnCommit) setText(value)
  }
  return (
    <input
      type="text"
      value={text}
      placeholder={placeholder}
      disabled={disabled}
      style={{ ...inputStyle, ...style }}
      onChange={e => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') commit()
        if (e.key === 'Escape') setText(value)
      }}
    />
  )
}

/** Edits of one ticket node (DESIGN.md §4.6.11); every edit goes to the draft. */
export function NodeEditor({ node, bundle }: { node: VertoNode; bundle: DeliveryMapBundle }) {
  const { draft, statusOptions, edit, discard } = useEditing()
  const disabled = draft.writing
  const nodeById = new Map(bundle.graph.nodes.map(n => [n.id, n]))
  const blockers = bundle.graph.edges
    .filter(e => e.to === node.id && e.reason === 'blocking')
    .map(e => nodeById.get(e.from))
    .filter((n): n is VertoNode => Boolean(n))
  const candidates = bundle.graph.nodes
    .filter(n => n.nodeType === 'ticket' && n.id !== node.id && !blockers.some(b => b.id === n.id))
    .sort((a, b) => a.title.localeCompare(b.title))
  const status = node.status ?? ''
  const options = statusOptions.includes(status) || status === '' ? statusOptions : [status, ...statusOptions]
  const pendingPriority = pendingSet(draft, node.id, 'priority')

  return (
    <Stack gap={8} style={{ paddingTop: 8, borderTop: '1px solid var(--vscode-panel-border)' }}>
      <Text size="small" weight="semibold" tone="tertiary">
        Edit{draft.canWrite ? '' : ` (local preview: ${draft.adapter} write-back is not supported yet)`}
      </Text>
      <Row gap={8} wrap>
        <Label>Title</Label>
        <CommitInput
          value={node.title}
          disabled={disabled}
          style={{ flex: 1, minWidth: 240 }}
          onCommit={title => edit({ type: 'set', nodeId: node.id, key: 'title', value: title })}
        />
      </Row>
      <Row gap={8} wrap>
        <Label>Status</Label>
        {options.length > 0 ? (
          <select
            value={status}
            disabled={disabled}
            style={inputStyle}
            onChange={e => edit({ type: 'set', nodeId: node.id, key: 'status', value: e.target.value })}
          >
            {status === '' && <option value="">—</option>}
            {options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <CommitInput
            value={status}
            disabled={disabled}
            onCommit={value => edit({ type: 'set', nodeId: node.id, key: 'status', value })}
          />
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
          <input
            type="checkbox"
            checked={node.isDone}
            disabled={disabled}
            onChange={e => edit({ type: 'set', nodeId: node.id, key: 'isDone', value: e.target.checked })}
          />
          Done
        </label>
        <Label>Priority</Label>
        <PrioritySelect
          value={node.priority}
          pending={Boolean(pendingPriority)}
          disabled={disabled}
          onChoose={level => {
            if (level !== null) edit({ type: 'set', nodeId: node.id, key: 'priority', value: level })
            else if (pendingPriority) discard([pendingPriority.change])
          }}
        />
      </Row>
      <Row gap={8} wrap>
        <Label>Personas</Label>
        <CommitInput
          value={node.personas.join(', ')}
          placeholder="comma-separated"
          disabled={disabled}
          style={{ flex: 1, minWidth: 200 }}
          onCommit={text => edit({
            type: 'set',
            nodeId: node.id,
            key: 'personas',
            value: [...new Set(text.split(',').map(s => s.trim()).filter(Boolean))],
          })}
        />
      </Row>
      <Row gap={6} wrap>
        <Label>Blocked by</Label>
        {blockers.map(b => (
          <Pill key={b.id} size="sm" tone={b.isDone ? 'success' : 'deleted'}>
            {b.title}
            <button
              type="button"
              title="Remove this blocker"
              disabled={disabled}
              style={xStyle}
              onClick={() => edit({ type: 'link', nodeId: node.id, blockerId: b.id, add: false })}
            >
              ×
            </button>
          </Pill>
        ))}
        <select
          value=""
          disabled={disabled || candidates.length === 0}
          style={inputStyle}
          onChange={e => {
            if (e.target.value) edit({ type: 'link', nodeId: node.id, blockerId: e.target.value, add: true })
          }}
        >
          <option value="">+ blocker…</option>
          {candidates.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </Row>
      <Row gap={8} wrap>
        <Label>New child</Label>
        <CommitInput
          value=""
          placeholder="title, then Enter"
          disabled={disabled}
          clearOnCommit
          style={{ flex: 1, minWidth: 200 }}
          onCommit={title => {
            if (title.trim()) edit({ type: 'create', nodeId: '', parentId: node.id, title: title.trim() })
          }}
        />
      </Row>
    </Stack>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <Text size="small" tone="tertiary" style={{ minWidth: 64 }}>{children}</Text>
}

const inputStyle: React.CSSProperties = {
  fontSize: 12,
  padding: '3px 6px',
  background: 'var(--vscode-input-background)',
  color: 'var(--vscode-input-foreground)',
  border: '1px solid var(--vscode-input-border, var(--vscode-panel-border))',
  borderRadius: 4,
}

const xStyle: React.CSSProperties = {
  marginLeft: 4,
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'inherit',
  padding: 0,
  lineHeight: 1,
}
