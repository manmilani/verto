import { describe, it, expect } from 'vitest'
import { leverageScores } from '../algorithms/leverage.js'
import { node, edge, graph } from './helpers.js'

describe('leverageScores', () => {
  it('empty graph returns empty object', () => {
    expect(leverageScores(graph([]))).toEqual({})
  })

  it('isolated node has leverage 0', () => {
    const scores = leverageScores(graph([node('A')]))
    expect(scores['A']).toBe(0)
  })

  it('linear chain A→B→C', () => {
    const g = graph([node('A'), node('B'), node('C')], [edge('A', 'B'), edge('B', 'C')])
    const scores = leverageScores(g)
    expect(scores['A']).toBe(2) // B and C depend on A
    expect(scores['B']).toBe(1) // only C depends on B
    expect(scores['C']).toBe(0) // nothing depends on C
  })

  it('diamond: shared prereq has highest leverage', () => {
    // A → B → D; A → C → D
    const g = graph(
      [node('A'), node('B'), node('C'), node('D')],
      [edge('A', 'B'), edge('A', 'C'), edge('B', 'D'), edge('C', 'D')],
    )
    const scores = leverageScores(g)
    expect(scores['A']).toBe(3) // B, C, D
    expect(scores['B']).toBe(1) // D
    expect(scores['C']).toBe(1) // D
    expect(scores['D']).toBe(0)
  })

  it('multi-parent DAG: shared node counted once', () => {
    // A → C; B → C; C → D
    const g = graph(
      [node('A'), node('B'), node('C'), node('D')],
      [edge('A', 'C'), edge('B', 'C'), edge('C', 'D')],
    )
    const scores = leverageScores(g)
    expect(scores['A']).toBe(2) // C, D — not counted twice
    expect(scores['B']).toBe(2) // C, D
    expect(scores['C']).toBe(1) // D
    expect(scores['D']).toBe(0)
  })

  it('fully done graph: scores are structural, not affected by isDone', () => {
    const g = graph(
      [node('A', { isDone: true }), node('B', { isDone: true })],
      [edge('A', 'B')],
    )
    const scores = leverageScores(g)
    expect(scores['A']).toBe(1)
    expect(scores['B']).toBe(0)
  })
})
