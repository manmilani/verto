import React, { useState } from 'react'
import type { DraftEntryView } from '../../shared/protocol.js'
import { useEditing } from '../editing.js'

const STATE_TEXT: Record<DraftEntryView['state'], string> = {
  applied: '',
  noop: 'no change',
  notLoaded: 'not loaded',
  invalid: 'invalid',
}

/** Toolbar: the pending draft, Write back and Discard (DESIGN.md §4.6.11). Hidden when the draft is empty. */
export function DraftBar() {
  const { draft, discard, writeBack } = useEditing()
  const [open, setOpen] = useState(false)
  if (draft.entries.length === 0) return null

  const invalid = draft.entries.find(e => e.state === 'invalid')
  const writeTitle = !draft.canWrite
    ? `${draft.adapter} write-back is not supported yet; edits are a local preview`
    : invalid
      ? `Not written while the draft doesn't validate: ${invalid.error ?? 'invalid'}`
      : draft.mode === 'immediate'
        ? 'Retry writing the pending changes'
        : 'Write the pending changes to the tracker'
  const failed = draft.entries.filter(e => e.error).length

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6 }}>
      <button type="button" style={pendingStyle(failed > 0)} onClick={() => setOpen(v => !v)} aria-expanded={open}>
        {draft.entries.length} pending{failed > 0 ? ` (${failed} with errors)` : ''} ▾
      </button>
      <button
        type="button"
        style={buttonStyle(!draft.canWrite || Boolean(invalid) || draft.writing)}
        disabled={!draft.canWrite || Boolean(invalid) || draft.writing}
        title={writeTitle}
        onClick={writeBack}
      >
        {draft.writing ? 'Writing…' : 'Write back'}
      </button>
      <button type="button" style={linkStyle} disabled={draft.writing} onClick={() => discard()}>
        Discard all
      </button>
      {open && (
        <div style={listStyle}>
          {draft.entries.map((e, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 8px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12 }}>{e.label}</div>
                {(e.error || STATE_TEXT[e.state]) && (
                  <div style={{ fontSize: 11, color: e.error ? 'var(--vscode-errorForeground)' : 'var(--vscode-descriptionForeground)' }}>
                    {[STATE_TEXT[e.state], e.error].filter(Boolean).join(': ')}
                  </div>
                )}
              </div>
              <button
                type="button"
                title="Discard this change"
                style={xStyle}
                disabled={draft.writing}
                onClick={() => discard([e.change])}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function pendingStyle(hasErrors: boolean): React.CSSProperties {
  return {
    fontSize: 12,
    padding: '3px 10px',
    borderRadius: 12,
    cursor: 'pointer',
    background: 'transparent',
    color: hasErrors ? 'var(--vscode-errorForeground)' : 'var(--vscode-foreground)',
    border: `1px solid ${hasErrors ? 'var(--vscode-errorForeground)' : 'var(--vscode-panel-border)'}`,
  }
}

function buttonStyle(disabled: boolean): React.CSSProperties {
  return {
    fontSize: 12,
    padding: '3px 12px',
    borderRadius: 4,
    border: 'none',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    background: 'var(--vscode-button-background)',
    color: 'var(--vscode-button-foreground)',
  }
}

const linkStyle: React.CSSProperties = {
  fontSize: 12,
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--vscode-textLink-foreground)',
}

const xStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--vscode-foreground)',
  fontSize: 14,
  lineHeight: 1,
}

const listStyle: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 4px)',
  right: 0,
  zIndex: 30,
  minWidth: 320,
  maxHeight: 360,
  overflowY: 'auto',
  padding: '4px 0',
  background: 'var(--vscode-dropdown-background)',
  border: '1px solid var(--vscode-dropdown-border)',
  borderRadius: 4,
  boxShadow: '0 4px 12px color-mix(in srgb, var(--vscode-widget-shadow) 40%, transparent)',
}
