import { describe, it, expect } from 'vitest'
import { closureFor } from '../algorithms/closure.js'
import { node, edge, graph } from './helpers.js'

describe('closureFor', () => {
  it('empty graph returns set with just the requested id (unknown node)', () => {
    const g = graph([])
    expect(closureFor(g, 'x')).toEqual(new Set(['x']))
  })

  it('isolated node returns singleton closure', () => {
    const g = graph([node('A')])
    expect(closureFor(g, 'A')).toEqual(new Set(['A']))
  })

  it('linear chain: closure of tail includes all ancestors', () => {
    // A → B → C (A prereq for B, B prereq for C)
    const g = graph(
      [node('A'), node('B'), node('C')],
      [edge('A', 'B'), edge('B', 'C')],
    )
    expect(closureFor(g, 'C')).toEqual(new Set(['A', 'B', 'C']))
    expect(closureFor(g, 'B')).toEqual(new Set(['A', 'B']))
    expect(closureFor(g, 'A')).toEqual(new Set(['A']))
  })

  it('diamond: closure of top includes all nodes', () => {
    // A → B → D; A → C → D
    const g = graph(
      [node('A'), node('B'), node('C'), node('D')],
      [edge('A', 'B'), edge('A', 'C'), edge('B', 'D'), edge('C', 'D')],
    )
    expect(closureFor(g, 'D')).toEqual(new Set(['A', 'B', 'C', 'D']))
    expect(closureFor(g, 'B')).toEqual(new Set(['A', 'B']))
    expect(closureFor(g, 'C')).toEqual(new Set(['A', 'C']))
  })

  it('multi-parent DAG', () => {
    // A → C; B → C; B → D; C → E; D → E
    const g = graph(
      [node('A'), node('B'), node('C'), node('D'), node('E')],
      [edge('A', 'C'), edge('B', 'C'), edge('B', 'D'), edge('C', 'E'), edge('D', 'E')],
    )
    expect(closureFor(g, 'E')).toEqual(new Set(['A', 'B', 'C', 'D', 'E']))
    expect(closureFor(g, 'C')).toEqual(new Set(['A', 'B', 'C']))
    expect(closureFor(g, 'D')).toEqual(new Set(['B', 'D']))
  })

  it('does not include sibling or unrelated nodes', () => {
    const g = graph(
      [node('A'), node('B'), node('Unrelated')],
      [edge('A', 'B')],
    )
    expect(closureFor(g, 'B')).not.toContain('Unrelated')
  })
})
