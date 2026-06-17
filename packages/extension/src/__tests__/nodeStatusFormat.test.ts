import { describe, it, expect } from 'vitest'
import type { DisplayStatusGroup } from '@verto/config'
import { formatNodeStatus, formatPriority } from '../webview/nodeStatusFormat.js'

const defaultGroups: DisplayStatusGroup[] = [
  { label: 'Done',        sources: { ticket: { isDone: true },  parsed: { isDone: true } } },
  { label: 'In Progress', sources: { ticket: { isDone: false, statuses: ['In Progress'] } } },
  { label: 'Raw',         sources: { parsed:  { isDone: false, statuses: ['raw'] } } },
]

describe('formatNodeStatus', () => {
  it('matched group + raw status → "<group> (<raw>)"', () => {
    expect(formatNodeStatus(
      { nodeType: 'ticket', isDone: false, status: 'In Progress' },
      defaultGroups,
    )).toBe('In Progress (In Progress)')
  })

  it('matched group + no raw status → "<group>"', () => {
    expect(formatNodeStatus(
      { nodeType: 'ticket', isDone: true, status: undefined },
      defaultGroups,
    )).toBe('Done')
  })

  it('undone ticket with unknown status matches In Progress group (isDone predicate wins)', () => {
    // In Progress rule has isDone:false — any undone ticket matches it regardless of status
    expect(formatNodeStatus(
      { nodeType: 'ticket', isDone: false, status: 'Backlog' },
      defaultGroups,
    )).toBe('In Progress (Backlog)')
  })

  it('undone ticket with no status matches In Progress group', () => {
    expect(formatNodeStatus(
      { nodeType: 'ticket', isDone: false, status: undefined },
      defaultGroups,
    )).toBe('In Progress')
  })

  it('falls to Other when no group has a rule for this nodeType', () => {
    // Groups with only ticket rules — parsed nodes fall to Other
    const ticketOnlyGroups: DisplayStatusGroup[] = [
      { label: 'Done', sources: { ticket: { isDone: true } } },
      { label: 'In Progress', sources: { ticket: { isDone: false } } },
    ]
    expect(formatNodeStatus(
      { nodeType: 'parsed', isDone: false, status: 'custom' },
      ticketOnlyGroups,
    )).toBe('Other (custom)')
  })

  it('parsed done node matches Done group', () => {
    expect(formatNodeStatus(
      { nodeType: 'parsed', isDone: true, status: 'done' },
      defaultGroups,
    )).toBe('Done (done)')
  })

  it('parsed raw node matches Raw group', () => {
    expect(formatNodeStatus(
      { nodeType: 'parsed', isDone: false, status: 'raw' },
      defaultGroups,
    )).toBe('Raw (raw)')
  })

  it('empty groups → falls through to Other', () => {
    expect(formatNodeStatus(
      { nodeType: 'ticket', isDone: false, status: 'Todo' },
      [],
    )).toBe('Other (Todo)')
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
    // In practice ranking is always > 0, but guard the replace edge case
    expect(formatPriority(0)).toBe('—')
  })

  it('undefined → "—"', () => {
    expect(formatPriority(undefined)).toBe('—')
  })

  it('multi-digit no trailing zeros: 125 → "125"', () => {
    expect(formatPriority(125)).toBe('125')
  })
})
