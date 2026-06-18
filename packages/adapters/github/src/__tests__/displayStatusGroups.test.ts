import { describe, it, expect } from 'vitest'
import { buildProjectDisplayStatusGroups } from '../audit.js'

describe('buildProjectDisplayStatusGroups', () => {
  it('maps first status to Raw, last to Done, and middle to In Progress', () => {
    const groups = buildProjectDisplayStatusGroups([
      'Draft',
      'To_Specify',
      'Specifying',
      'Closed',
    ])
    expect(groups).toHaveLength(3)
    expect(groups[0]).toEqual({
      label: 'Done',
      sources: {
        ticket: { isDone: true, statuses: ['Closed'] },
        parsed: { isDone: true, statuses: ['done'] },
      },
    })
    expect(groups[1]).toEqual({
      label: 'In Progress',
      sources: { ticket: { isDone: false, statuses: ['To_Specify', 'Specifying'] } },
    })
    expect(groups[2]).toEqual({
      label: 'Raw',
      sources: {
        ticket: { isDone: false, statuses: ['Draft'] },
        parsed: { isDone: false, statuses: ['raw'] },
      },
    })
  })

  it('omits In Progress when only two status options exist', () => {
    const groups = buildProjectDisplayStatusGroups(['Draft', 'Closed'])
    expect(groups).toHaveLength(2)
    expect(groups.map(g => g.label)).toEqual(['Done', 'Raw'])
  })
})
