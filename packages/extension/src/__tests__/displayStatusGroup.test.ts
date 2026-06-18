import { describe, it, expect } from 'vitest'
import { resolveDisplayStatusGroup, isDoneBucket, isGap, groupLabelsWithOther, OTHER_DISPLAY_STATUS_GROUP, countByDisplayStatusGroup, formatDisplayGroupCounts, summarizePipelineByDisplayGroup, weightByDisplayStatusGroup } from '../webview/displayStatusGroup.js'
import type { DisplayStatusGroup } from '@verto/config'
import type { VertoNode } from '@verto/core'

// Default groups from defaults.verto.config.jsonc
const defaultGroups: DisplayStatusGroup[] = [
  { label: 'Done', sources: { ticket: { isDone: true }, parsed: { isDone: true } } },
  { label: 'Raw', sources: { parsed: { isDone: false, statuses: ['raw'] } } },
]

describe('isDoneBucket', () => {
  it('identifies Done group as done-bucket', () => {
    expect(isDoneBucket(defaultGroups[0])).toBe(true)
  })
  it('identifies Raw as non-done-bucket', () => {
    expect(isDoneBucket(defaultGroups[1])).toBe(false)
  })
})

describe('resolveDisplayStatusGroup', () => {
  it('done ticket → Done', () => {
    expect(resolveDisplayStatusGroup(
      { nodeType: 'ticket', isDone: true, status: 'Done' },
      defaultGroups,
    )).toBe('Done')
  })

  it('done parsed → Done', () => {
    expect(resolveDisplayStatusGroup(
      { nodeType: 'parsed', isDone: true, status: 'done' },
      defaultGroups,
    )).toBe('Done')
  })

  it('open ticket with workflow status → Other', () => {
    expect(resolveDisplayStatusGroup(
      { nodeType: 'ticket', isDone: false, status: 'In Progress' },
      defaultGroups,
    )).toBe(OTHER_DISPLAY_STATUS_GROUP)
  })

  it('open ticket with non-matching status → Other', () => {
    expect(resolveDisplayStatusGroup(
      { nodeType: 'ticket', isDone: false, status: 'Todo' },
      defaultGroups,
    )).toBe(OTHER_DISPLAY_STATUS_GROUP)
  })

  it('open ticket with undefined status → Other', () => {
    expect(resolveDisplayStatusGroup(
      { nodeType: 'ticket', isDone: false, status: undefined },
      defaultGroups,
    )).toBe(OTHER_DISPLAY_STATUS_GROUP)
  })

  it('undone parsed with status raw → Raw', () => {
    expect(resolveDisplayStatusGroup(
      { nodeType: 'parsed', isDone: false, status: 'raw' },
      defaultGroups,
    )).toBe('Raw')
  })

  it('ticket with no matching group → Other (custom groups)', () => {
    const custom: DisplayStatusGroup[] = [
      { label: 'Done', sources: { ticket: { isDone: true } } },
    ]
    expect(resolveDisplayStatusGroup(
      { nodeType: 'ticket', isDone: false, status: 'Review' },
      custom,
    )).toBe(OTHER_DISPLAY_STATUS_GROUP)
  })

  it('does not match status in non-done bucket for isDone:true row', () => {
    expect(resolveDisplayStatusGroup(
      { nodeType: 'ticket', isDone: true, status: 'In Progress' },
      defaultGroups,
    )).toBe('Done')
  })

  it('undefined status does not match statuses-only rule with empty string', () => {
    const groups: DisplayStatusGroup[] = [
      { label: 'EmptyStatus', sources: { ticket: { statuses: [''] } } },
      { label: 'Done', sources: { ticket: { isDone: true } } },
    ]
    expect(resolveDisplayStatusGroup(
      { nodeType: 'ticket', isDone: false, status: undefined },
      groups,
    )).toBe(OTHER_DISPLAY_STATUS_GROUP)
  })
})

describe('groupLabelsWithOther', () => {
  it('appends Other after configured labels', () => {
    expect(groupLabelsWithOther(defaultGroups)).toEqual([
      'Done', 'Raw', OTHER_DISPLAY_STATUS_GROUP,
    ])
  })

  it('does not duplicate Other when a configured group already uses that label', () => {
    const groups: DisplayStatusGroup[] = [
      { label: 'Other', sources: { ticket: { isDone: true } } },
    ]
    expect(groupLabelsWithOther(groups)).toEqual(['Other'])
    expect(countByDisplayStatusGroup(
      [{ nodeType: 'ticket', isDone: true, status: 'Done' }],
      groups,
    )).toEqual({ Other: 1 })
  })
})

describe('countByDisplayStatusGroup', () => {
  it('counts rows per configured group label', () => {
    const rows = [
      { nodeType: 'ticket' as const, isDone: true, status: 'Done' },
      { nodeType: 'ticket' as const, isDone: false, status: 'In Progress' },
      { nodeType: 'parsed' as const, isDone: false, status: 'raw' },
      { nodeType: 'ticket' as const, isDone: false, status: 'Review' },
    ]
    expect(countByDisplayStatusGroup(rows, defaultGroups)).toEqual({
      Done: 1,
      Raw: 1,
      Other: 2,
    })
  })
})

describe('formatDisplayGroupCounts', () => {
  it('formats non-zero counts in config order', () => {
    const counts = { Done: 3, Raw: 0, Other: 1 }
    expect(formatDisplayGroupCounts(counts, defaultGroups)).toBe(
      '3 Done · 1 Other',
    )
  })
})

describe('summarizePipelineByDisplayGroup', () => {
  it('accumulates counts and weights in one pass', () => {
    const rows: VertoNode[] = [
      { id: 'a', title: 'A', isDone: true, status: 'Done', nodeType: 'ticket', nodeOrigin: 'github', isDeliverySlice: false, priority: 5, prereqIds: [], childIds: [], ticketUrl: 'u', weight: 2 },
      { id: 'b', title: 'B', isDone: false, status: 'In Progress', nodeType: 'ticket', nodeOrigin: 'github', isDeliverySlice: false, priority: 5, prereqIds: [], childIds: [], ticketUrl: 'u' },
    ]
    const { counts, weights } = summarizePipelineByDisplayGroup(rows, defaultGroups)
    expect(counts).toEqual({ Done: 1, Raw: 0, Other: 1 })
    expect(weights).toEqual({ Done: 2, Raw: 0, Other: 1 })
    expect(formatDisplayGroupCounts(weights, defaultGroups)).toBe('2 Done · 1 Other')
  })
})

describe('weightByDisplayStatusGroup', () => {
  it('returns only weight sums', () => {
    const rows: VertoNode[] = [
      { id: 'a', title: 'A', isDone: true, status: 'Done', nodeType: 'ticket', nodeOrigin: 'github', isDeliverySlice: false, priority: 5, prereqIds: [], childIds: [], ticketUrl: 'u', weight: 2 },
    ]
    expect(weightByDisplayStatusGroup(rows, defaultGroups)).toEqual({
      Done: 2, Raw: 0, Other: 0,
    })
  })
})

describe('isGap', () => {
  it('open ticket → gap (no done-bucket match)', () => {
    expect(isGap(
      { nodeType: 'ticket', isDone: false, status: 'In Progress' },
      defaultGroups,
    )).toBe(true)
  })

  it('done ticket → not a gap', () => {
    expect(isGap(
      { nodeType: 'ticket', isDone: true, status: 'Done' },
      defaultGroups,
    )).toBe(false)
  })

  it('done parsed → not a gap', () => {
    expect(isGap(
      { nodeType: 'parsed', isDone: true, status: 'done' },
      defaultGroups,
    )).toBe(false)
  })

  it('undone raw parsed → gap', () => {
    expect(isGap(
      { nodeType: 'parsed', isDone: false, status: 'raw' },
      defaultGroups,
    )).toBe(true)
  })
})
