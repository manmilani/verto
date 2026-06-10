import { describe, it, expect } from 'vitest'
import { validateGraph } from '../validation.js'
import { node, edge, graph } from './helpers.js'

describe('validateGraph', () => {
  it('valid empty graph', () => {
    const result = validateGraph(graph([]))
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('valid simple graph with no issues', () => {
    const g = graph(
      [node('A'), node('B')],
      [edge('A', 'B')],
    )
    const result = validateGraph(g)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('dangling prereqId produces an error', () => {
    const n = node('A', { prereqIds: ['nonexistent'] })
    const result = validateGraph({ nodes: [n], edges: [] })
    expect(result.valid).toBe(false)
    const err = result.errors.find(e => e.type === 'dangling_prereq')
    expect(err).toBeDefined()
    expect(err!.nodeId).toBe('A')
  })

  it('dangling childId produces an error', () => {
    const n = { ...node('A'), childIds: ['ghost'], prereqIds: ['ghost'] }
    const result = validateGraph({ nodes: [n], edges: [] })
    const errs = result.errors.filter(e => e.type === 'dangling_child' || e.type === 'dangling_prereq')
    expect(errs.length).toBeGreaterThan(0)
  })

  it('priority below 1 produces an invalid_priority error', () => {
    const g = graph([node('A', { priority: 0 })])
    const result = validateGraph(g)
    const err = result.errors.find(e => e.type === 'invalid_priority')
    expect(err).toBeDefined()
    expect(err!.nodeId).toBe('A')
  })

  it('priority above 9 produces an invalid_priority error', () => {
    const g = graph([node('A', { priority: 10 })])
    const result = validateGraph(g)
    expect(result.errors.some(e => e.type === 'invalid_priority')).toBe(true)
  })

  it('non-integer priority produces an invalid_priority error', () => {
    const g = graph([node('A', { priority: 3.5 })])
    const result = validateGraph(g)
    expect(result.errors.some(e => e.type === 'invalid_priority')).toBe(true)
  })

  it('childId not in prereqIds produces child_not_in_prereqs error', () => {
    const A = node('A')
    const B = { ...node('B'), childIds: ['A'], prereqIds: [] } // childId present but not in prereqIds
    const result = validateGraph({ nodes: [A, B], edges: [] })
    expect(result.errors.some(e => e.type === 'child_not_in_prereqs')).toBe(true)
  })

  it('childId in prereqIds is valid', () => {
    const A = node('A')
    const B = { ...node('B'), childIds: ['A'], prereqIds: ['A'] }
    const result = validateGraph({ nodes: [A, B], edges: [] })
    expect(result.errors.filter(e => e.type === 'child_not_in_prereqs')).toHaveLength(0)
  })

  it('missing ticketUrl produces a warning (not an error)', () => {
    const n = { ...node('A'), ticketUrl: undefined }
    const result = validateGraph({ nodes: [n], edges: [] })
    expect(result.valid).toBe(true) // warnings don't make it invalid
    expect(result.warnings.some(w => w.type === 'missing_ticket_url')).toBe(true)
  })

  it('cycle detection: direct self-loop', () => {
    const n = node('A', { prereqIds: ['A'] })
    const result = validateGraph({ nodes: [n], edges: [] })
    expect(result.errors.some(e => e.type === 'cycle')).toBe(true)
  })

  it('cycle detection: two-node cycle', () => {
    const A = node('A', { prereqIds: ['B'] })
    const B = node('B', { prereqIds: ['A'] })
    const result = validateGraph({ nodes: [A, B], edges: [] })
    expect(result.errors.some(e => e.type === 'cycle')).toBe(true)
  })

  it('cycle detection: three-node cycle', () => {
    const A = node('A', { prereqIds: ['C'] })
    const B = node('B', { prereqIds: ['A'] })
    const C = node('C', { prereqIds: ['B'] })
    const result = validateGraph({ nodes: [A, B, C], edges: [] })
    expect(result.errors.some(e => e.type === 'cycle')).toBe(true)
  })

  it('acyclic graph is not flagged as cyclic', () => {
    const g = graph([node('A'), node('B'), node('C')], [edge('A', 'B'), edge('B', 'C')])
    const result = validateGraph(g)
    expect(result.errors.filter(e => e.type === 'cycle')).toHaveLength(0)
  })

  it('valid graph with multiple issues returns all errors', () => {
    const n = node('X', { priority: 0, prereqIds: ['missing'] })
    const result = validateGraph({ nodes: [n], edges: [] })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.type === 'invalid_priority')).toBe(true)
    expect(result.errors.some(e => e.type === 'dangling_prereq')).toBe(true)
  })
})
