import { describe, it, expect } from 'vitest'
import type { VertoNode } from '../types.js'
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

  it('missing ticketUrl on ticket node produces an error', () => {
    const n = { ...node('A'), ticketUrl: '' } as VertoNode
    const result = validateGraph({ nodes: [n], edges: [] })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.type === 'missing_ticket_url')).toBe(true)
    expect(result.warnings.some(w => w.type === 'missing_ticket_url')).toBe(false)
  })

  it('missing ticketUrl on parsed node produces a warning not an error', () => {
    const n = {
      ...node('A'),
      nodeType: 'parsed' as const,
      nodeOrigin: 'parsed-nodes',
      ticketUrl: '',
    }
    const result = validateGraph({ nodes: [n], edges: [] })
    expect(result.warnings.some(w => w.type === 'missing_ticket_url')).toBe(true)
    expect(result.errors.some(e => e.type === 'missing_ticket_url')).toBe(false)
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

  // prereqs_consistency tests
  it('prereqs_consistency: extra id in prereqIds not in edges/childIds/parsedReqs → error', () => {
    const A = node('A')
    const B = node('B', { prereqIds: ['A'] }) // 'A' is in prereqIds but no blocking edge A→B
    const result = validateGraph({ nodes: [A, B], edges: [] })
    expect(result.errors.some(e => e.type === 'prereqs_consistency')).toBe(true)
  })

  it('prereqs_consistency: missing childId in prereqIds → both child_not_in_prereqs and prereqs_consistency error', () => {
    const A = node('A')
    const B = node('B', { childIds: ['A'], prereqIds: [] }) // childId not in prereqIds
    const result = validateGraph({ nodes: [A, B], edges: [] })
    expect(result.errors.some(e => e.type === 'child_not_in_prereqs')).toBe(true)
    expect(result.errors.some(e => e.type === 'prereqs_consistency')).toBe(true)
  })

  it('prereqs_consistency: consistent graph (blocking edge) → no error', () => {
    const A = node('A')
    const B = node('B', { prereqIds: ['A'] })
    const result = validateGraph({
      nodes: [A, B],
      edges: [{ from: 'A', to: 'B', reason: 'blocking' }],
    })
    expect(result.errors.filter(e => e.type === 'prereqs_consistency')).toHaveLength(0)
  })

  // parsedReqs_integrity tests
  it('parsedReqs_integrity: parsedReqs id that references a non-existent node → error', () => {
    const A = node('A', { parsedReqs: ['A#raw-req-1'], prereqIds: ['A#raw-req-1'] })
    const result = validateGraph({ nodes: [A], edges: [] })
    expect(result.errors.some(e => e.type === 'parsedReqs_integrity')).toBe(true)
  })

  it('parsedReqs_integrity: parsedReqs id referencing a ticket node → error', () => {
    const B = node('B') // ticket, not parsed
    const A = node('A', { parsedReqs: ['B'], prereqIds: ['B'] })
    const result = validateGraph({ nodes: [A, B], edges: [] })
    expect(result.errors.some(e => e.type === 'parsedReqs_integrity')).toBe(true)
  })

  it('parsedReqs_integrity: parsed-req edge with no matching parsedReqs entry on target → error', () => {
    const P1 = { ...node('P1'), nodeType: 'parsed' as const, nodeOrigin: 'parsed-nodes' }
    const A = node('A', { parsedReqs: [] })
    const result = validateGraph({
      nodes: [A, P1],
      edges: [{ from: 'P1', to: 'A', reason: 'parsed-req' as const }],
    })
    expect(result.errors.some(e => e.type === 'parsedReqs_integrity')).toBe(true)
  })

  it('parsedReqs_integrity: well-formed parsed graph → no integrity errors', () => {
    const P1 = { ...node('P1'), nodeType: 'parsed' as const, nodeOrigin: 'parsed-nodes' }
    const A = node('A', { parsedReqs: ['P1'], prereqIds: ['P1'] })
    const result = validateGraph({
      nodes: [A, P1],
      edges: [{ from: 'P1', to: 'A', reason: 'parsed-req' as const }],
    })
    const relevant = result.errors.filter(
      e => e.type === 'parsedReqs_integrity' || e.type === 'prereqs_consistency',
    )
    expect(relevant).toHaveLength(0)
  })
})
