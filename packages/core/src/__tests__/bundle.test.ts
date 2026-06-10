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
})
