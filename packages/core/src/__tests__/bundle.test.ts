import { describe, it, expect } from 'vitest'
import { buildDeliveryMapBundle } from '../bundle.js'
import { node, edge, graph } from './helpers.js'

describe('buildDeliveryMapBundle', () => {
  it('empty graph returns bundle with all empty collections', () => {
    const g = graph([])
    const bundle = buildDeliveryMapBundle(g)
    expect(bundle.graph).toBe(g)
    expect(bundle.implementationOrder).toEqual([])
    expect(bundle.readyIds).toEqual([])
    expect(bundle.leverageScore).toEqual({})
    expect(bundle.globalPriorityRanking).toEqual({})
    expect(bundle.deliveryCompleteness).toEqual({})
  })

  it('single delivery slice node — all fields populated', () => {
    const g = graph([node('A', { isDeliverySlice: true, priority: 3 })])
    const bundle = buildDeliveryMapBundle(g)

    expect(bundle.readyIds).toEqual(['A'])
    expect(bundle.implementationOrder).toEqual(['A'])
    expect(bundle.leverageScore!['A']).toBe(0)
    expect(bundle.globalPriorityRanking!['A']).toBe(3)
    expect(bundle.deliveryCompleteness!['A']).toBe(0)
  })

  it('linear chain: ready = first node; order respects deps; completeness varies', () => {
    const g = graph(
      [node('A', { priority: 1, isDeliverySlice: false }), node('B', { priority: 2, isDeliverySlice: true })],
      [edge('A', 'B')],
    )
    const bundle = buildDeliveryMapBundle(g)

    // Only A is ready (B needs A)
    expect(bundle.readyIds).toEqual(['A'])
    // Order: A first, then B
    expect(bundle.implementationOrder).toEqual(['A', 'B'])
    // Leverage: A has 1 dependent (B)
    expect(bundle.leverageScore!['A']).toBe(1)
    expect(bundle.leverageScore!['B']).toBe(0)
    // Delivery completeness: A closure={A} none done; B closure={A,B} none done
    expect(bundle.deliveryCompleteness!['A']).toBe(0)
    expect(bundle.deliveryCompleteness!['B']).toBe(0)
  })

  it('graph with a done node: delivery completeness reflects it', () => {
    const g = graph(
      [node('A', { isDone: true }), node('B', { isDeliverySlice: true })],
      [edge('A', 'B')],
    )
    const bundle = buildDeliveryMapBundle(g)

    expect(bundle.readyIds).toEqual(['B'])
    expect(bundle.deliveryCompleteness!['B']).toBeCloseTo(0.5) // A done, B not
  })

  it('bundle passes through the original graph reference unchanged', () => {
    const g = graph([node('A')])
    const bundle = buildDeliveryMapBundle(g)
    expect(bundle.graph).toBe(g)
  })

  it('servedBySliceIds — node in single slice closure', () => {
    const g = graph(
      [node('A'), node('S', { isDeliverySlice: true })],
      [edge('A', 'S')],
    )
    const bundle = buildDeliveryMapBundle(g)
    // A is in the closure of S (S depends on A); S is in its own closure
    expect(bundle.servedBySliceIds!['A']).toContain('S')
    expect(bundle.servedBySliceIds!['S']).toContain('S')
  })

  it('servedBySliceIds — node in two slice closures', () => {
    const g = graph(
      [node('A'), node('S1', { isDeliverySlice: true }), node('S2', { isDeliverySlice: true })],
      [edge('A', 'S1'), edge('A', 'S2')],
    )
    const bundle = buildDeliveryMapBundle(g)
    expect(bundle.servedBySliceIds!['A']).toContain('S1')
    expect(bundle.servedBySliceIds!['A']).toContain('S2')
    expect(bundle.servedBySliceIds!['A']).toHaveLength(2)
  })

  it('servedBySliceIds — node not in any slice closure is absent', () => {
    const g = graph(
      [node('A'), node('S', { isDeliverySlice: true }), node('B')],
      [edge('A', 'S')],  // B is not a prereq of S
    )
    const bundle = buildDeliveryMapBundle(g)
    expect(bundle.servedBySliceIds!['B']).toBeUndefined()
  })

  it('servedBySliceIds — empty graph returns empty map', () => {
    const g = graph([])
    const bundle = buildDeliveryMapBundle(g)
    expect(bundle.servedBySliceIds).toEqual({})
  })

  it('invalid graph (cycle) returns a best-effort bundle without throwing', () => {
    // buildDeliveryMapBundle does not validate — that is the caller's responsibility.
    // Algorithms apply cycle guards internally and return partial results.
    const A = node('A', { prereqIds: ['B'] })
    const B = node('B', { prereqIds: ['A'] })
    const g: import('../types.js').VertoGraph = { nodes: [A, B], edges: [] }
    expect(() => buildDeliveryMapBundle(g)).not.toThrow()
    const bundle = buildDeliveryMapBundle(g)
    expect(bundle.graph).toBe(g)
    expect(bundle.implementationOrder).toHaveLength(2) // both cyclic nodes appended
    expect(bundle.readyIds).toHaveLength(0) // neither is ready (each blocked by the other)
  })
})
