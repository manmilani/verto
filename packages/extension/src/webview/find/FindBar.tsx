import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { stepIndex } from './findMatches.js'
import { clearHighlights, findRanges, paintHighlights, revealRange } from './domFind.js'

/**
 * Ctrl/Cmd+F find bar over the text under `root` (the bar itself is rendered outside it).
 * Enter / Shift+Enter, F3 / Shift+F3: next / previous (wrapping); Esc closes.
 */
export function FindBar({ root }: { root: React.RefObject<HTMLElement | null> }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [, render] = useReducer((n: number) => n + 1, 0)
  const state = useRef({ open: false, query: '', ranges: [] as Range[], index: -1 })
  const inputRef = useRef<HTMLInputElement>(null)
  const returnFocus = useRef<Element | null>(null)

  const update = useCallback((ranges: Range[], index: number, reveal: boolean) => {
    Object.assign(state.current, { ranges, index })
    paintHighlights(ranges, ranges[index])
    if (reveal && index >= 0) revealRange(ranges[index])
    render()
  }, [])

  /** `reveal`: jump to the first match (typing, opening); otherwise keep the current index. */
  const search = useCallback((reveal: boolean) => {
    const { query: q, index } = state.current
    const ranges = root.current && q ? findRanges(root.current, q) : []
    const kept = reveal ? 0 : Math.max(0, Math.min(index, ranges.length - 1))
    update(ranges, ranges.length ? kept : -1, reveal)
  }, [root, update])

  const step = useCallback((dir: 1 | -1) => {
    const { ranges, index } = state.current
    update(ranges, stepIndex(index, ranges.length, dir), true)
  }, [update])

  const close = useCallback(() => {
    Object.assign(state.current, { open: false, ranges: [], index: -1 })
    clearHighlights()
    setOpen(false)
    const el = returnFocus.current
    if (el instanceof HTMLElement && el.isConnected) el.focus()
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        if (!state.current.open) {
          returnFocus.current = document.activeElement
          state.current.open = true
          setOpen(true)
          search(true)
        }
        requestAnimationFrame(() => inputRef.current?.select())
      } else if (e.key === 'F3' && state.current.open) {
        e.preventDefault()
        step(e.shiftKey ? -1 : 1)
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [search, step])

  useEffect(() => {
    const el = root.current
    if (!open || !el) return
    let frame = 0
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => search(false))
    })
    observer.observe(el, { childList: true, characterData: true, subtree: true })
    return () => { observer.disconnect(); cancelAnimationFrame(frame) }
  }, [open, root, search])

  useEffect(() => clearHighlights, [])

  if (!open) return null

  const { ranges, index } = state.current
  const hasMatches = ranges.length > 0
  return (
    <div role="search" style={barStyle}>
      <input
        ref={inputRef}
        value={query}
        placeholder="Find"
        aria-label="Find"
        style={inputStyle}
        onChange={e => {
          setQuery(e.target.value)
          state.current.query = e.target.value
          search(true)
        }}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            e.preventDefault()
            step(e.shiftKey ? -1 : 1)
          } else if (e.key === 'Escape') {
            e.preventDefault()
            close()
          }
        }}
      />
      <span style={{ ...countStyle, ...(query && !hasMatches ? { color: 'var(--vscode-errorForeground)' } : undefined) }}>
        {!query ? '' : hasMatches ? `${index + 1} of ${ranges.length}` : 'No results'}
      </span>
      <button type="button" style={buttonStyle} disabled={!hasMatches} title="Previous match (Shift+Enter)" onClick={() => step(-1)}>↑</button>
      <button type="button" style={buttonStyle} disabled={!hasMatches} title="Next match (Enter)" onClick={() => step(1)}>↓</button>
      <button type="button" style={buttonStyle} title="Close (Escape)" onClick={close}>×</button>
    </div>
  )
}

const barStyle: React.CSSProperties = {
  position: 'fixed',
  top: 46,
  right: 18,
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '4px 6px',
  borderRadius: 4,
  fontSize: 12,
  color: 'var(--vscode-editorWidget-foreground, var(--vscode-foreground))',
  background: 'var(--vscode-editorWidget-background)',
  border: '1px solid var(--vscode-editorWidget-border, transparent)',
  boxShadow: '0 0 8px 2px var(--vscode-widget-shadow)',
}

const inputStyle: React.CSSProperties = {
  width: 200,
  padding: '3px 6px',
  fontSize: 12,
  color: 'var(--vscode-input-foreground)',
  background: 'var(--vscode-input-background)',
  border: '1px solid var(--vscode-input-border, transparent)',
  borderRadius: 2,
}

const countStyle: React.CSSProperties = {
  minWidth: 64,
  padding: '0 4px',
  whiteSpace: 'nowrap',
}

const buttonStyle: React.CSSProperties = {
  background: 'transparent',
  color: 'inherit',
  border: 'none',
  borderRadius: 3,
  padding: '2px 6px',
  cursor: 'pointer',
  fontSize: 13,
}
