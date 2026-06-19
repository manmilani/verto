import { describe, it, expect } from 'vitest'
import { buildProjectDisplayStatusGroups } from '../audit.js'

describe('buildProjectDisplayStatusGroups', () => {
  it('maps first status to Raw ticket, middle to In Progress; omits system Done', () => {
    const groups = buildProjectDisplayStatusGroups([
      'Draft',
      'To_Specify',
      'Specifying',
      'Closed',
    ])
    expect(groups).toHaveLength(2)
    expect(groups[0]).toEqual({
      label: 'In Progress',
      sources: { ticket: { statuses: ['To_Specify', 'Specifying'] } },
    })
    expect(groups[1]).toEqual({
      label: 'Raw',
      sources: {
        ticket: { statuses: ['Draft'] },
        parsed: { statuses: ['raw'] },
      },
    })
  })

  it('omits In Progress when only two status options exist', () => {
    const groups = buildProjectDisplayStatusGroups(['Draft', 'Closed'])
    expect(groups).toHaveLength(1)
    expect(groups[0]?.label).toBe('Raw')
    expect(groups[0]?.sources.ticket?.statuses).toEqual(['Draft'])
  })

  it('with no status options seeds parsed Raw only', () => {
    const groups = buildProjectDisplayStatusGroups([])
    expect(groups).toEqual([{ label: 'Raw', sources: { parsed: { statuses: ['raw'] } } }])
  })
})
