import { describe, it, expect } from 'vitest'
import { deliveryCompleteness } from '../algorithms/completeness.js'
import { node, edge, graph } from './helpers.js'

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
})
