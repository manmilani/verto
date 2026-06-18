import { describe, it, expect } from 'vitest'
import { resolveDisplayStatusGroup, isDoneBucket, isGap, groupLabelsWithOther, groupLabelsForDisplay, OTHER_DISPLAY_STATUS_GROUP, countByDisplayStatusGroup, formatDisplayGroupCounts, summarizePipelineByDisplayGroup, weightByDisplayStatusGroup, shouldShowOtherColumn, hasOpenTicketStatusOutsideConfiguredLists } from '../webview/displayStatusGroup.js'
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

describe('groupLabelsForDisplay', () => {
  it('omits Other when all rows map to configured groups', () => {
    const groups: DisplayStatusGroup[] = [
      { label: 'Done', sources: { ticket: { isDone: true, statuses: ['Closed'] } } },
      { label: 'In Progress', sources: { ticket: { isDone: false, statuses: ['Doing'] } } },
      { label: 'Raw', sources: { ticket: { isDone: false, statuses: ['Draft'] } } },
    ]
    const rows = [
      { nodeType: 'ticket' as const, isDone: true, status: 'Closed' },
      { nodeType: 'ticket' as const, isDone: false, status: 'Doing' },
      { nodeType: 'ticket' as const, isDone: false, status: 'Draft' },
    ]
    expect(groupLabelsForDisplay(groups, rows)).toEqual(['Done', 'In Progress', 'Raw'])
  })

  it('includes Other when a row is unmapped', () => {
    const rows = [
      { nodeType: 'ticket' as const, isDone: false, status: 'Mystery' },
    ]
    expect(groupLabelsForDisplay(defaultGroups, rows)).toEqual([
      'Done', 'Raw', OTHER_DISPLAY_STATUS_GROUP,
    ])
  })

  it('includes Other when an open ticket status is removed from In Progress list', () => {
    const groups: DisplayStatusGroup[] = [
      { label: 'Done', sources: { ticket: { isDone: true, statuses: ['Closed'] } } },
      { label: 'In Progress', sources: { ticket: { isDone: false, statuses: ['Doing'] } } },
      { label: 'Raw', sources: { ticket: { isDone: false, statuses: ['Draft'] } } },
    ]
    const rows = [
      { nodeType: 'ticket' as const, isDone: false, status: 'Specifying' },
    ]
    expect(resolveDisplayStatusGroup(rows[0], groups)).toBe(OTHER_DISPLAY_STATUS_GROUP)
    expect(groupLabelsForDisplay(groups, rows)).toEqual([
      'Done', 'In Progress', 'Raw', OTHER_DISPLAY_STATUS_GROUP,
    ])
  })

  it('includes Other for Child-Care-Hub style config when status is unlisted', () => {
    const groups: DisplayStatusGroup[] = [
      { label: 'Done', sources: { ticket: { isDone: true, statuses: ['Closed'] }, parsed: { isDone: true, statuses: ['done'] } } },
      { label: 'In Progress', sources: { ticket: { isDone: false, statuses: ['To_Plan', 'Planning', 'To_Implement', 'Implementing', 'To_Verify', 'Verifying'] } } },
      { label: 'Raw', sources: { ticket: { isDone: false, statuses: ['Draft'] }, parsed: { isDone: false, statuses: ['raw'] } } },
    ]
    const rows = [
      { nodeType: 'ticket' as const, isDone: false, status: 'To_Specify' },
    ]
    expect(shouldShowOtherColumn(groups, rows)).toBe(true)
    expect(hasOpenTicketStatusOutsideConfiguredLists(rows, groups)).toBe(true)
    expect(groupLabelsForDisplay(groups, rows)).toContain(OTHER_DISPLAY_STATUS_GROUP)
  })

  it('does not match In Progress via isDone:false alone when statuses are listed', () => {
    const groups: DisplayStatusGroup[] = [
      { label: 'In Progress', sources: { ticket: { isDone: false, statuses: ['Doing'] } } },
    ]
    expect(resolveDisplayStatusGroup(
      { nodeType: 'ticket', isDone: false, status: 'Specifying' },
      groups,
    )).toBe(OTHER_DISPLAY_STATUS_GROUP)
  })

  it('done ticket still matches Done when statuses is also configured', () => {
    const groups: DisplayStatusGroup[] = [
      { label: 'Done', sources: { ticket: { isDone: true, statuses: ['Closed'] } } },
    ]
    expect(resolveDisplayStatusGroup(
      { nodeType: 'ticket', isDone: true, status: 'Any Legacy Label' },
      groups,
    )).toBe('Done')
  })
})

describe('groupLabelsWithOther', () => {
  it('appends Other after configured labels', () => {
    expect(groupLabelsWithOther(defaultGroups)).toEqual([
      'Done', 'Raw', OTHER_DISPLAY_STATUS_GROUP,
    ])
  })

  it('does not duplicate others when a configured group already uses that label', () => {
    const groups: DisplayStatusGroup[] = [
      { label: 'others', sources: { ticket: { isDone: true } } },
    ]
    expect(groupLabelsWithOther(groups)).toEqual(['others'])
    expect(countByDisplayStatusGroup(
      [{ nodeType: 'ticket', isDone: true, status: 'Done' }],
      groups,
    )).toEqual({ others: 1 })
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
      others: 2,
    })
  })
})

describe('formatDisplayGroupCounts', () => {
  it('formats non-zero counts in config order', () => {
    const counts = { Done: 3, Raw: 0, others: 1 }
    expect(formatDisplayGroupCounts(counts, defaultGroups)).toBe(
      '3 Done · 1 others',
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
    expect(counts).toEqual({ Done: 1, Raw: 0, others: 1 })
    expect(weights).toEqual({ Done: 2, Raw: 0, others: 1 })
    expect(formatDisplayGroupCounts(weights, defaultGroups)).toBe('2 Done · 1 others')
  })
})

describe('weightByDisplayStatusGroup', () => {
  it('returns only weight sums', () => {
    const rows: VertoNode[] = [
      { id: 'a', title: 'A', isDone: true, status: 'Done', nodeType: 'ticket', nodeOrigin: 'github', isDeliverySlice: false, priority: 5, prereqIds: [], childIds: [], ticketUrl: 'u', weight: 2 },
    ]
    expect(weightByDisplayStatusGroup(rows, defaultGroups)).toEqual({
      Done: 2, Raw: 0, others: 0,
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
