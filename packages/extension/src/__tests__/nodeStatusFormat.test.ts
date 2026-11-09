import { describe, it, expect } from 'vitest'
import type { DisplayStatusGroup } from '@verto/config'
import { formatNodeStatus, formatPriority } from '../webview/nodeStatusFormat.js'

const defaultGroups: DisplayStatusGroup[] = [
  { label: 'Raw', sources: { parsed: { statuses: ['raw'] } } },
]

describe('formatNodeStatus', () => {
  it('raw status equal to the group label (case-insensitive) → "<group>"', () => {
    expect(formatNodeStatus(
      { nodeType: 'parsed', isDone: false, status: 'raw' },
      defaultGroups,
    )).toBe('Raw')
  })

  it('raw status differing from the group label → "<group> (<raw>)"', () => {
    const groups: DisplayStatusGroup[] = [
      { label: 'Raw', sources: { ticket: { statuses: ['Todo'] } } },
    ]
    expect(formatNodeStatus(
      { nodeType: 'ticket', isDone: false, status: 'Todo' },
      groups,
    )).toBe('Raw (Todo)')
  })

  it('raw status equal to a ticket group label → "<group>"', () => {
    const groups: DisplayStatusGroup[] = [
      { label: 'In Progress', sources: { ticket: { statuses: ['In Progress'] } } },
    ]
    expect(formatNodeStatus(
      { nodeType: 'ticket', isDone: false, status: 'In Progress' },
      groups,
    )).toBe('In Progress')
  })

  it('done ticket → system Done label', () => {
    expect(formatNodeStatus(
      { nodeType: 'ticket', isDone: true, status: undefined },
      defaultGroups,
    )).toBe('Done')
  })

  it('undone ticket with workflow status → others', () => {
    expect(formatNodeStatus(
      { nodeType: 'ticket', isDone: false, status: 'Backlog' },
      defaultGroups,
    )).toBe('others (Backlog)')
  })

  it('undone ticket with no status → others', () => {
    expect(formatNodeStatus(
      { nodeType: 'ticket', isDone: false, status: undefined },
      defaultGroups,
    )).toBe('others')
  })

  it('parsed node with no matching parsed rule → others', () => {
    const ticketOnlyGroups: DisplayStatusGroup[] = [
      { label: 'Doing', sources: { ticket: { statuses: ['Doing'] } } },
    ]
    expect(formatNodeStatus(
      { nodeType: 'parsed', isDone: false, status: 'custom' },
      ticketOnlyGroups,
    )).toBe('others (custom)')
  })

  it('parsed done node → Done (system)', () => {
    expect(formatNodeStatus(
      { nodeType: 'parsed', isDone: true, status: 'done' },
      defaultGroups,
    )).toBe('Done')
  })

  it('parsed raw node matches Raw group', () => {
    expect(formatNodeStatus(
      { nodeType: 'parsed', isDone: false, status: 'raw' },
      defaultGroups,
    )).toBe('Raw')
  })

  it('empty groups → falls through to others', () => {
    expect(formatNodeStatus(
      { nodeType: 'ticket', isDone: false, status: 'Todo' },
      [],
    )).toBe('others (Todo)')
  })
})

describe('formatPriority', () => {
  it('strips trailing zeros: 13200 → "132"', () => {
    expect(formatPriority(13200)).toBe('132')
  })

  it('strips trailing zeros: 30000 → "3"', () => {
    expect(formatPriority(30000)).toBe('3')
  })

  it('no trailing zeros: 3 → "3"', () => {
    expect(formatPriority(3)).toBe('3')
  })

  it('all zeros after stripping → "—" (e.g. value of 0 would be edge case)', () => {
    expect(formatPriority(0)).toBe('—')
  })

  it('undefined → "—"', () => {
    expect(formatPriority(undefined)).toBe('—')
  })

  it('multi-digit no trailing zeros: 125 → "125"', () => {
    expect(formatPriority(125)).toBe('125')
  })
})
