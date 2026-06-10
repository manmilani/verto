import { describe, it, expect } from 'vitest'
import { isReady, readyNodes } from '../algorithms/readiness.js'
import { node, edge, graph } from './helpers.js'

describe('isReady', () => {
  it('isolated not-done node with no prereqs is ready', () => {
    const g = graph([node('A')])
    expect(isReady(g, g.nodes[0])).toBe(true)
  })

  it('done node is never ready', () => {
    const g = graph([node('A', { isDone: true })])
    expect(isReady(g, g.nodes[0])).toBe(false)
  })

  it('node whose prereq is not done is not ready', () => {
    const g = graph([node('A'), node('B')], [edge('A', 'B')])
    const B = g.nodes.find(n => n.id === 'B')!
    expect(isReady(g, B)).toBe(false)
  })

  it('node whose prereq is done is ready', () => {
    const g = graph([node('A', { isDone: true }), node('B')], [edge('A', 'B')])
    const B = g.nodes.find(n => n.id === 'B')!
    expect(isReady(g, B)).toBe(true)
  })

  it('node with multiple prereqs: all must be done', () => {
    const g = graph(
      [node('A', { isDone: true }), node('B'), node('C')],
      [edge('A', 'C'), edge('B', 'C')],
    )
    const C = g.nodes.find(n => n.id === 'C')!
    expect(isReady(g, C)).toBe(false) // B not done
  })

  it('node with multiple prereqs: all done → ready', () => {
    const g = graph(
      [node('A', { isDone: true }), node('B', { isDone: true }), node('C')],
      [edge('A', 'C'), edge('B', 'C')],
    )
    const C = g.nodes.find(n => n.id === 'C')!
    expect(isReady(g, C)).toBe(true)
  })
})

describe('readyNodes', () => {
  it('empty graph returns empty array', () => {
    expect(readyNodes(graph([]))).toEqual([])
  })

  it('fully done graph returns empty array', () => {
    const g = graph([node('A', { isDone: true }), node('B', { isDone: true })])
    expect(readyNodes(g)).toEqual([])
  })

  it('linear chain A→B→C where A is done: only B is ready', () => {
    const g = graph(
      [node('A', { isDone: true }), node('B'), node('C')],
      [edge('A', 'B'), edge('B', 'C')],
    )
    const ready = readyNodes(g).map(n => n.id)
    expect(ready).toEqual(['B'])
  })

  it('diamond where A is done: B and C are both ready', () => {
    const g = graph(
      [node('A', { isDone: true }), node('B'), node('C'), node('D')],
      [edge('A', 'B'), edge('A', 'C'), edge('B', 'D'), edge('C', 'D')],
    )
    const ready = readyNodes(g).map(n => n.id).sort()
    expect(ready).toEqual(['B', 'C'])
  })
})
