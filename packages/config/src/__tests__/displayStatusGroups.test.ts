import { describe, it, expect } from 'vitest'
import type { DisplayStatusGroup } from '../types.js'
import {
  SYSTEM_DONE_DISPLAY_GROUP_LABEL,
  OTHER_DISPLAY_STATUS_GROUP,
  validateUserDisplayStatusGroups,
  resolveDisplayStatusGroup,
  groupLabelsForDisplay,
  shouldShowOthersColumn,
  buildStatusUniverse,
  isGap,
  resolveDisplayStatusGroupIndex,
  formatDoneGroupTooltip,
  formatUserGroupTooltip,
  formatOthersGroupTooltip,
  buildDisplayStatusGroupTooltips,
  formatDisplayGroupsProse,
} from '../displayStatusGroups.js'

const rawOnly: DisplayStatusGroup[] = [
  { label: 'Raw', sources: { parsed: { statuses: ['raw'] } } },
]

const threeGroup: DisplayStatusGroup[] = [
  { label: 'In Progress', sources: { ticket: { statuses: ['To_Plan', 'Planning'] } } },
  { label: 'Raw', sources: { ticket: { statuses: ['Draft'] }, parsed: { statuses: ['raw'] } } },
]

describe('validateUserDisplayStatusGroups', () => {
  it('rejects reserved Done label case-insensitively', () => {
    expect(() => validateUserDisplayStatusGroups([
      { label: 'done', sources: { ticket: { statuses: ['X'] } } },
    ])).toThrow(/system-reserved/i)
    expect(() => validateUserDisplayStatusGroups([
      { label: 'Done', sources: { ticket: { statuses: ['X'] } } },
    ])).toThrow(/system-reserved/i)
  })

  it('rejects reserved others label', () => {
    expect(() => validateUserDisplayStatusGroups([
      { label: 'others', sources: { ticket: { statuses: ['Backlog'] } } },
    ])).toThrow(/system-reserved/i)
  })

  it('rejects duplicate labels', () => {
    expect(() => validateUserDisplayStatusGroups([
      { label: 'A', sources: { ticket: { statuses: ['X'] } } },
      { label: 'A', sources: { ticket: { statuses: ['Y'] } } },
    ])).toThrow(/duplicate/i)
  })

  it('rejects empty statuses', () => {
    expect(() => validateUserDisplayStatusGroups([
      { label: 'Bad', sources: { ticket: { statuses: [] } } },
    ])).toThrow()
  })

  it('rejects overlapping ticket statuses across groups', () => {
    expect(() => validateUserDisplayStatusGroups([
      { label: 'A', sources: { ticket: { statuses: ['Draft'] } } },
      { label: 'B', sources: { ticket: { statuses: ['Draft'] } } },
    ])).toThrow(/Draft/)
  })

  it('rejects overlapping parsed statuses across groups', () => {
    expect(() => validateUserDisplayStatusGroups([
      { label: 'A', sources: { parsed: { statuses: ['raw'] } } },
      { label: 'B', sources: { parsed: { statuses: ['raw'] } } },
    ])).toThrow(/raw/)
  })
})

describe('resolveDisplayStatusGroup', () => {
  it('done nodes always map to system Done regardless of status', () => {
    expect(resolveDisplayStatusGroup(
      { nodeType: 'ticket', isDone: true, status: 'Draft' },
      threeGroup,
    )).toBe(SYSTEM_DONE_DISPLAY_GROUP_LABEL)
  })

  it('open ticket matches first group with listed status', () => {
    expect(resolveDisplayStatusGroup(
      { nodeType: 'ticket', isDone: false, status: 'To_Plan' },
      threeGroup,
    )).toBe('In Progress')
  })

  it('open ticket with unlisted status maps to others', () => {
    expect(resolveDisplayStatusGroup(
      { nodeType: 'ticket', isDone: false, status: 'To_Specify' },
      threeGroup,
    )).toBe(OTHER_DISPLAY_STATUS_GROUP)
  })

  it('parsed done maps to system Done via isDone', () => {
    expect(resolveDisplayStatusGroup(
      { nodeType: 'parsed', isDone: true, status: 'done' },
      threeGroup,
    )).toBe(SYSTEM_DONE_DISPLAY_GROUP_LABEL)
  })

  it('parsed raw maps to Raw group', () => {
    expect(resolveDisplayStatusGroup(
      { nodeType: 'parsed', isDone: false, status: 'raw' },
      threeGroup,
    )).toBe('Raw')
  })

  it('first matching user group wins on overlap in config (validation prevents overlap)', () => {
    const groups: DisplayStatusGroup[] = [
      { label: 'First', sources: { ticket: { statuses: ['A'] } } },
      { label: 'Second', sources: { ticket: { statuses: ['B'] } } },
    ]
    expect(resolveDisplayStatusGroup(
      { nodeType: 'ticket', isDone: false, status: 'B' },
      groups,
    )).toBe('Second')
  })
})

describe('shouldShowOthersColumn (config sufficiency)', () => {
  it('hides others when all ticket and parsed universe statuses are accounted for', () => {
    const groups: DisplayStatusGroup[] = [
      { label: 'In Progress', sources: { ticket: { statuses: ['To_Plan', 'Planning', 'Closed'] } } },
      { label: 'Raw', sources: { ticket: { statuses: ['Draft'] }, parsed: { statuses: ['raw'] } } },
    ]
    const universe = buildStatusUniverse(
      [
        { nodeType: 'ticket', status: 'Draft' },
        { nodeType: 'ticket', status: 'To_Plan' },
        { nodeType: 'parsed', status: 'raw' },
      ],
      ['Planning', 'Closed'],
    )
    expect(shouldShowOthersColumn(groups, universe)).toBe(false)
  })

  it('shows others when a ticket status in universe is not in any user group', () => {
    const universe = buildStatusUniverse(
      [{ nodeType: 'ticket', status: 'To_Specify' }],
      ['Draft', 'To_Plan'],
    )
    expect(shouldShowOthersColumn(threeGroup, universe)).toBe(true)
  })

  it('shows others when parsed universe has unaccounted status', () => {
    const universe = buildStatusUniverse(
      [{ nodeType: 'parsed', status: 'custom' }],
      [],
    )
    expect(shouldShowOthersColumn(rawOnly, universe)).toBe(true)
  })

  it('treats parsed done as accounted without listing it in config', () => {
    const universe = buildStatusUniverse(
      [{ nodeType: 'parsed', status: 'done' }, { nodeType: 'parsed', status: 'raw' }],
      [],
    )
    expect(shouldShowOthersColumn(rawOnly, universe)).toBe(false)
  })
})

describe('groupLabelsForDisplay', () => {
  it('always includes system Done first', () => {
    expect(groupLabelsForDisplay(threeGroup, false)[0]).toBe(SYSTEM_DONE_DISPLAY_GROUP_LABEL)
  })

  it('appends others only when showOthers is true', () => {
    expect(groupLabelsForDisplay(threeGroup, false)).toEqual([
      SYSTEM_DONE_DISPLAY_GROUP_LABEL, 'In Progress', 'Raw',
    ])
    expect(groupLabelsForDisplay(threeGroup, true)).toContain(OTHER_DISPLAY_STATUS_GROUP)
  })
})

describe('isGap', () => {
  it('open nodes are gaps; done nodes are not', () => {
    expect(isGap({ isDone: false })).toBe(true)
    expect(isGap({ isDone: true })).toBe(false)
  })
})

describe('resolveDisplayStatusGroupIndex', () => {
  it('Done is index 0; user groups are offset by 1; others is -1', () => {
    expect(resolveDisplayStatusGroupIndex(
      { nodeType: 'ticket', isDone: true, status: 'X' },
      threeGroup,
    )).toBe(0)
    expect(resolveDisplayStatusGroupIndex(
      { nodeType: 'ticket', isDone: false, status: 'Draft' },
      threeGroup,
    )).toBe(2)
    expect(resolveDisplayStatusGroupIndex(
      { nodeType: 'ticket', isDone: false, status: 'Mystery' },
      threeGroup,
    )).toBe(-1)
  })
})

describe('formatDisplayGroupsProse', () => {
  it('uses fallback when no user groups are configured', () => {
    expect(formatDisplayGroupsProse([])).toBe('in a configured delivery state')
  })

  it('lists Done and user group labels', () => {
    expect(formatDisplayGroupsProse(rawOnly)).toBe('Done, or Raw')
  })
})

describe('display status group tooltips', () => {
  it('Done tooltip describes default issue.closed when no isDone mapping', () => {
    expect(formatDoneGroupTooltip()).toContain('issue.closed')
  })

  it('Done tooltip lists isDone-mapped status values', () => {
    const tip = formatDoneGroupTooltip({
      isDone: {
        from: { kind: 'projectV2', field: 'Status' },
        type: 'select',
        values: { Closed: true, Cancelled: true, Open: false },
      },
    })
    expect(tip).toContain('Status')
    expect(tip).toContain('Cancelled')
    expect(tip).toContain('Closed')
  })

  it('user group tooltip lists ticket and parsed statuses', () => {
    expect(formatUserGroupTooltip(threeGroup[1]!)).toBe('Tickets: Draft · Parsed: raw')
  })

  it('others tooltip lists unaccounted universe statuses', () => {
    const universe = buildStatusUniverse(
      [{ nodeType: 'ticket', status: 'To_Specify' }],
      ['Draft'],
    )
    const tip = formatOthersGroupTooltip(threeGroup, universe)
    expect(tip).toContain('To_Specify')
  })

  it('buildDisplayStatusGroupTooltips includes Done, user groups, and others when shown', () => {
    const universe = buildStatusUniverse([{ nodeType: 'ticket', status: 'Mystery' }], [])
    const tips = buildDisplayStatusGroupTooltips(threeGroup, universe, undefined, true)
    expect(tips.Done).toBeDefined()
    expect(tips['In Progress']).toContain('To_Plan')
    expect(tips.others).toContain('Mystery')
  })
})
