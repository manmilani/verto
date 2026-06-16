import { describe, it, expect } from 'vitest'
import { assignPortfolioColumn, isDoneBucket, isGap } from '../webview/portfolioMatch.js'
import type { PortfolioColumn } from '@verto/config'

// Default columns from defaults.verto.config.jsonc
const defaultColumns: PortfolioColumn[] = [
  { label: 'Done',        sources: { ticket: { isDone: true },  parsed: { isDone: true } } },
  { label: 'In Progress', sources: { ticket: { isDone: false, statuses: ['In Progress'] } } },
  { label: 'Raw',         sources: { parsed:  { isDone: false, statuses: ['raw'] } } },
]

describe('isDoneBucket', () => {
  it('identifies Done column as done-bucket', () => {
    expect(isDoneBucket(defaultColumns[0])).toBe(true)
  })
  it('identifies In Progress as non-done-bucket', () => {
    expect(isDoneBucket(defaultColumns[1])).toBe(false)
  })
  it('identifies Raw as non-done-bucket', () => {
    expect(isDoneBucket(defaultColumns[2])).toBe(false)
  })
})

describe('assignPortfolioColumn', () => {
  it('done ticket → Done', () => {
    expect(assignPortfolioColumn(
      { nodeType: 'ticket', isDone: true, status: 'Done' },
      defaultColumns,
    )).toBe('Done')
  })

  it('done parsed → Done', () => {
    expect(assignPortfolioColumn(
      { nodeType: 'parsed', isDone: true, status: 'done' },
      defaultColumns,
    )).toBe('Done')
  })

  it('in-progress ticket with matching status → In Progress', () => {
    expect(assignPortfolioColumn(
      { nodeType: 'ticket', isDone: false, status: 'In Progress' },
      defaultColumns,
    )).toBe('In Progress')
  })

  it('open ticket with non-matching status → In Progress (isDone:false predicate)', () => {
    // The isDone:false predicate on In Progress matches ANY open ticket, not just those
    // with status "In Progress". This is the OR semantics — confirm it's correct on dogfood.
    expect(assignPortfolioColumn(
      { nodeType: 'ticket', isDone: false, status: 'Todo' },
      defaultColumns,
    )).toBe('In Progress')
  })

  it('open ticket with undefined status → In Progress', () => {
    expect(assignPortfolioColumn(
      { nodeType: 'ticket', isDone: false, status: undefined },
      defaultColumns,
    )).toBe('In Progress')
  })

  it('undone parsed with status raw → Raw', () => {
    expect(assignPortfolioColumn(
      { nodeType: 'parsed', isDone: false, status: 'raw' },
      defaultColumns,
    )).toBe('Raw')
  })

  it('ticket with no matching column → Other (custom columns)', () => {
    const custom: PortfolioColumn[] = [
      { label: 'Done', sources: { ticket: { isDone: true } } },
    ]
    expect(assignPortfolioColumn(
      { nodeType: 'ticket', isDone: false, status: 'Review' },
      custom,
    )).toBe('Other')
  })

  it('does not match status in non-done bucket for isDone:true row', () => {
    // Row is done but In Progress is not a done-bucket — statusMatch must not fire
    expect(assignPortfolioColumn(
      { nodeType: 'ticket', isDone: true, status: 'In Progress' },
      defaultColumns,
    )).toBe('Done')
  })
})

describe('isGap', () => {
  it('open ticket → gap (In Progress is not a done-bucket)', () => {
    expect(isGap(
      { nodeType: 'ticket', isDone: false, status: 'In Progress' },
      defaultColumns,
    )).toBe(true)
  })

  it('done ticket → not a gap', () => {
    expect(isGap(
      { nodeType: 'ticket', isDone: true, status: 'Done' },
      defaultColumns,
    )).toBe(false)
  })

  it('done parsed → not a gap', () => {
    expect(isGap(
      { nodeType: 'parsed', isDone: true, status: 'done' },
      defaultColumns,
    )).toBe(false)
  })

  it('undone raw parsed → gap', () => {
    expect(isGap(
      { nodeType: 'parsed', isDone: false, status: 'raw' },
      defaultColumns,
    )).toBe(true)
  })
})
