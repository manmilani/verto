import { describe, it, expect } from 'vitest'
import { deliveryCompleteness, deliveryCompletenessMap, nodeWeight } from '../algorithms/completeness.js'
import { node, edge, graph } from './helpers.js'

describe('nodeWeight', () => {
  it('returns 1 when weight is absent', () => {
    expect(nodeWeight(node('A'))).toBe(1)
  })

  it('returns 1 for zero, negative, NaN, and non-numeric values', () => {
    expect(nodeWeight(node('A', { weight: 0 }))).toBe(1)
    expect(nodeWeight(node('A', { weight: -2 }))).toBe(1)
    expect(nodeWeight(node('A', { weight: Number.NaN }))).toBe(1)
    expect(nodeWeight(node('A', { weight: 'n/a' as unknown as number }))).toBe(1)
  })

  it('parses finite positive numeric strings', () => {
    expect(nodeWeight(node('A', { weight: '3' as unknown as number }))).toBe(3)
    expect(nodeWeight(node('A', { weight: ' 2.5 ' as unknown as number }))).toBe(2.5)
  })

  it('uses finite positive numbers as-is', () => {
    expect(nodeWeight(node('A', { weight: 4 }))).toBe(4)
  })
})

describe('deliveryCompleteness', () => {
  it('isolated done node is 1.0', () => {
    const g = graph([node('A', { isDone: true })])
    expect(deliveryCompleteness(g, 'A')).toBe(1)
  })

  it('isolated not-done node is 0.0', () => {
    const g = graph([node('A')])
    expect(deliveryCompleteness(g, 'A')).toBe(0)
  })

  it('linear chain A→B→C: nothing done → 0', () => {
    const g = graph([node('A'), node('B'), node('C')], [edge('A', 'B'), edge('B', 'C')])
    expect(deliveryCompleteness(g, 'C')).toBe(0)
  })

  it('linear chain A→B→C: A done → 1/3', () => {
    const g = graph(
      [node('A', { isDone: true }), node('B'), node('C')],
      [edge('A', 'B'), edge('B', 'C')],
    )
    expect(deliveryCompleteness(g, 'C')).toBeCloseTo(1 / 3)
  })

  it('linear chain A→B→C: A and B done → 2/3', () => {
    const g = graph(
      [node('A', { isDone: true }), node('B', { isDone: true }), node('C')],
      [edge('A', 'B'), edge('B', 'C')],
    )
    expect(deliveryCompleteness(g, 'C')).toBeCloseTo(2 / 3)
  })

  it('linear chain A→B→C: all done → 1', () => {
    const g = graph(
      [node('A', { isDone: true }), node('B', { isDone: true }), node('C', { isDone: true })],
      [edge('A', 'B'), edge('B', 'C')],
    )
    expect(deliveryCompleteness(g, 'C')).toBe(1)
  })

  it('diamond A→B→D, A→C→D: A done, B done → 2/4 = 0.5', () => {
    const g = graph(
      [node('A', { isDone: true }), node('B', { isDone: true }), node('C'), node('D')],
      [edge('A', 'B'), edge('A', 'C'), edge('B', 'D'), edge('C', 'D')],
    )
    expect(deliveryCompleteness(g, 'D')).toBe(0.5)
  })

  it('completeness for a leaf node only considers that node', () => {
    const g = graph([node('A'), node('B')], [edge('A', 'B')])
    // Closure of A = {A} (A has no prereqs)
    expect(deliveryCompleteness(g, 'A')).toBe(0)
  })

  it('unrelated nodes do not affect completeness of a slice', () => {
    const g = graph(
      [node('A', { isDone: true }), node('B'), node('Unrelated')],
      [edge('A', 'B')],
    )
    // Closure of B = {A, B}; Unrelated not included
    expect(deliveryCompleteness(g, 'B')).toBeCloseTo(0.5)
  })

  it('uses node weight in weighted completeness (default weight 1 unchanged)', () => {
    const g = graph(
      [node('A', { isDone: true, weight: 2 }), node('B'), node('C')],
      [edge('A', 'B'), edge('B', 'C')],
    )
    // Closure of C: A(weight 2, done) + B(weight 1) + C(weight 1) → doneWeight 2 / total 4
    expect(deliveryCompleteness(g, 'C')).toBeCloseTo(0.5)
  })

  it('string weight from untyped fieldMappings does not produce NaN', () => {
    const g = graph(
      [
        node('A', { isDone: true, weight: '2' as unknown as number }),
        node('B', { weight: '1' as unknown as number }),
      ],
      [edge('A', 'B')],
    )
    const c = deliveryCompleteness(g, 'B')
    expect(Number.isFinite(c)).toBe(true)
    expect(c).toBeCloseTo(2 / 3)
  })

  it('weight 0 is treated as absent (defaults to 1) — all-done closure is 1.0', () => {
    const g = graph(
      [node('A', { isDone: true, weight: 0 }), node('B', { isDone: true, weight: 0 })],
      [edge('A', 'B')],
    )
    expect(deliveryCompleteness(g, 'B')).toBe(1)
  })

  it('returns NaN for unknown nodeId (distinct from 0% complete)', () => {
    const g = graph([node('A')])
    expect(deliveryCompleteness(g, 'MISSING')).toBeNaN()
  })
})

describe('deliveryCompletenessMap', () => {
  it('includes every graph node id', () => {
    const g = graph([node('A'), node('B')], [edge('A', 'B')])
    const map = deliveryCompletenessMap(g)
    expect(Object.keys(map).sort()).toEqual(['A', 'B'])
  })

  it('matches per-node deliveryCompleteness for each id', () => {
    const g = graph(
      [node('A', { isDone: true }), node('B'), node('C')],
      [edge('A', 'B'), edge('B', 'C')],
    )
    const map = deliveryCompletenessMap(g)
    for (const n of g.nodes) {
      expect(map[n.id]).toBe(deliveryCompleteness(g, n.id))
    }
  })

  it('values are finite for a non-trivial graph', () => {
    const g = graph(
      [node('A', { isDone: true, weight: 2 }), node('B'), node('C')],
      [edge('A', 'B'), edge('B', 'C')],
    )
    const map = deliveryCompletenessMap(g)
    for (const v of Object.values(map)) {
      expect(Number.isFinite(v)).toBe(true)
    }
    expect(map['C']).toBeCloseTo(0.5)
  })
})
