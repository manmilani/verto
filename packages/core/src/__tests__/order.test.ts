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
})
