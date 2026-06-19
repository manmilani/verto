import { describe, it, expect } from 'vitest'
import {
  resolveDisplayStatusGroup,
  groupLabelsForDisplay,
  OTHER_DISPLAY_STATUS_GROUP,
  SYSTEM_DONE_DISPLAY_GROUP_LABEL,
  countByDisplayStatusGroup,
  formatDisplayGroupCounts,
  summarizePipelineByDisplayGroup,
  pillToneForNode,
} from '../webview/displayStatusGroup.js'
import type { DisplayStatusGroup } from '@verto/config'
import type { VertoNode } from '@verto/core'

const userGroups: DisplayStatusGroup[] = [
  { label: 'Raw', sources: { parsed: { statuses: ['raw'] } } },
]

describe('extension displayStatusGroup wrappers', () => {
  it('counts include system Done and others', () => {
    const rows = [
      { nodeType: 'ticket' as const, isDone: true, status: 'Closed' },
      { nodeType: 'ticket' as const, isDone: false, status: 'Todo' },
      { nodeType: 'parsed' as const, isDone: false, status: 'raw' },
    ]
    expect(countByDisplayStatusGroup(rows, userGroups)).toEqual({
      Done: 1,
      Raw: 1,
      others: 1,
    })
  })

  it('groupLabelsForDisplay delegates showOthers flag', () => {
    expect(groupLabelsForDisplay(userGroups, false)).toEqual(['Done', 'Raw'])
    expect(groupLabelsForDisplay(userGroups, true)).toEqual(['Done', 'Raw', OTHER_DISPLAY_STATUS_GROUP])
  })

  it('resolve maps done ticket to Done label', () => {
    expect(resolveDisplayStatusGroup(
      { nodeType: 'ticket', isDone: true, status: 'Any' },
      userGroups,
    )).toBe(SYSTEM_DONE_DISPLAY_GROUP_LABEL)
  })

  it('formatDisplayGroupCounts omits others when column hidden', () => {
    const counts = { Done: 3, Raw: 0, others: 1 }
    expect(formatDisplayGroupCounts(counts, userGroups, false)).toBe('3 Done')
    expect(formatDisplayGroupCounts(counts, userGroups, true)).toBe('3 Done · 1 others')
  })

  it('summarizePipelineByDisplayGroup accumulates weights', () => {
    const rows: VertoNode[] = [
      { id: 'a', title: 'A', isDone: true, status: 'Done', nodeType: 'ticket', nodeOrigin: 'github', isDeliverySlice: false, priority: 5, prereqIds: [], childIds: [], ticketUrl: 'u', weight: 2 },
      { id: 'b', title: 'B', isDone: false, status: 'Todo', nodeType: 'ticket', nodeOrigin: 'github', isDeliverySlice: false, priority: 5, prereqIds: [], childIds: [], ticketUrl: 'u' },
    ]
    const { counts, weights } = summarizePipelineByDisplayGroup(rows, userGroups)
    expect(counts).toEqual({ Done: 1, Raw: 0, others: 1 })
    expect(weights).toEqual({ Done: 2, Raw: 0, others: 1 })
  })

  it('pillToneForNode uses display group index for open nodes', () => {
    const groups: DisplayStatusGroup[] = [
      { label: 'In Progress', sources: { ticket: { statuses: ['Todo'] } } },
      { label: 'Raw', sources: { parsed: { statuses: ['raw'] } } },
    ]
    expect(pillToneForNode({ nodeType: 'ticket', isDone: true, status: 'Todo' }, groups)).toBe('success')
    expect(pillToneForNode({ nodeType: 'ticket', isDone: false, status: 'Todo' }, groups)).toBe('info')
    expect(pillToneForNode({ nodeType: 'ticket', isDone: false, status: 'Mystery' }, groups)).toBe('neutral')
  })
})
