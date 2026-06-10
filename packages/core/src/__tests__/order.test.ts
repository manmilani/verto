import { describe, it, expect } from 'vitest'
import { implementationOrder } from '../algorithms/order.js'
import { globalPriorityRanking } from '../algorithms/priority.js'
import { node, edge, graph } from './helpers.js'

describe('implementationOrder', () => {
  it('empty graph returns empty array', () => {
    const g = graph([])
    expect(implementationOrder(g, {})).toEqual([])
  })

  it('single not-done node', () => {
    const g = graph([node('A')])
    const r = globalPriorityRanking(g)
    expect(implementationOrder(g, r)).toEqual(['A'])
  })

  it('single done node is excluded', () => {
    const g = graph([node('A', { isDone: true })])
    const r = globalPriorityRanking(g)
    expect(implementationOrder(g, r)).toEqual([])
  })

  it('linear chain respects dependency order', () => {
    // A → B → C; all not done
    const g = graph([node('A'), node('B'), node('C')], [edge('A', 'B'), edge('B', 'C')])
    const r = globalPriorityRanking(g)
    const order = implementationOrder(g, r)
    // A must come before B, B before C
    expect(order.indexOf('A')).toBeLessThan(order.indexOf('B'))
    expect(order.indexOf('B')).toBeLessThan(order.indexOf('C'))
  })

  it('done prereqs are excluded from order', () => {
    // A(done) → B → C
    const g = graph(
      [node('A', { isDone: true }), node('B'), node('C')],
      [edge('A', 'B'), edge('B', 'C')],
    )
    const r = globalPriorityRanking(g)
    const order = implementationOrder(g, r)
    expect(order).not.toContain('A')
    expect(order.indexOf('B')).toBeLessThan(order.indexOf('C'))
  })

  it('diamond: higher-priority branch scheduled first when simultaneously available', () => {
    // A(done) → B(p=2) → D; A → C(p=7) → D
    // After A is done, both B and C are available. B(p=2) should be scheduled before C(p=7).
    const g = graph(
      [
        node('A', { priority: 5, isDone: true }),
        node('B', { priority: 2 }),
        node('C', { priority: 7 }),
        node('D', { priority: 5, isDeliverySlice: true }),
      ],
      [edge('A', 'B'), edge('A', 'C'), edge('B', 'D'), edge('C', 'D')],
    )
    const r = globalPriorityRanking(g)
    const order = implementationOrder(g, r)
    // B (ranking 520) < C (ranking 570) → B before C
    expect(order.indexOf('B')).toBeLessThan(order.indexOf('C'))
    // D must come after both B and C
    expect(order.indexOf('B')).toBeLessThan(order.indexOf('D'))
    expect(order.indexOf('C')).toBeLessThan(order.indexOf('D'))
  })

  it('all-done graph returns empty array', () => {
    const g = graph(
      [node('A', { isDone: true }), node('B', { isDone: true })],
      [edge('A', 'B')],
    )
    const r = globalPriorityRanking(g)
    expect(implementationOrder(g, r)).toEqual([])
  })

  it('disconnected nodes are all included', () => {
    const g = graph([node('X'), node('Y'), node('Z')])
    const r = globalPriorityRanking(g)
    const order = implementationOrder(g, r)
    expect(order.sort()).toEqual(['X', 'Y', 'Z'])
  })

  it('deterministic tie-break by id when rankings are equal', () => {
    // Two isolated DS nodes with same priority → same ranking → id sort
    const g = graph([
      node('B', { priority: 5, isDeliverySlice: true }),
      node('A', { priority: 5, isDeliverySlice: true }),
    ])
    const r = globalPriorityRanking(g)
    const order = implementationOrder(g, r)
    expect(order[0]).toBe('A') // lexicographically first
    expect(order[1]).toBe('B')
  })

  it('leverage breaks ranking ties — higher leverage node scheduled first', () => {
    // X(p=5) prereq for both A(p=3,DS) and B(p=3,DS); Y(p=5) prereq for C(p=3,DS) only.
    // X and Y have identical priority chains to equally-weighted DS nodes → equal rankings.
    // X has leverage 2 (A and B depend on it), Y has leverage 1 (C only).
    // Available initially: X and Y. X should be picked first due to higher leverage.
    const g = graph(
      [
        node('X', { priority: 5 }),
        node('Y', { priority: 5 }),
        node('A', { priority: 3, isDeliverySlice: true }),
        node('B', { priority: 3, isDeliverySlice: true }),
        node('C', { priority: 3, isDeliverySlice: true }),
      ],
      [edge('X', 'A'), edge('X', 'B'), edge('Y', 'C')],
    )
    const r = globalPriorityRanking(g)
    expect(r['X']).toBe(r['Y']) // confirm rankings are equal
    const order = implementationOrder(g, r)
    expect(order.indexOf('X')).toBeLessThan(order.indexOf('Y'))
  })

  it('cyclic graph: stuck nodes are appended after acyclic nodes', () => {
    // A and B form a cycle (each is the other's prereq). C is free.
    const A = node('A', { prereqIds: ['B'] })
    const B = node('B', { prereqIds: ['A'] })
    const C = node('C')
    const g: import('../types.js').VertoGraph = { nodes: [A, B, C], edges: [] }
    const r = globalPriorityRanking(g)
    const order = implementationOrder(g, r)
    expect(order).toHaveLength(3)
    expect(order).toContain('A')
    expect(order).toContain('B')
    expect(order).toContain('C')
    // C is acyclic — comes before stuck A and B
    expect(order.indexOf('C')).toBeLessThan(order.indexOf('A'))
    expect(order.indexOf('C')).toBeLessThan(order.indexOf('B'))
  })
})
