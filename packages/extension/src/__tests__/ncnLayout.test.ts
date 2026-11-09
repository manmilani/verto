import { describe, it, expect } from 'vitest'
import ELK from 'elkjs/lib/elk.bundled.js'
import type { VertoEdge } from '@verto/core'
import {
  dependencyDepth, packColumns, elkLayoutOptions, NCN_LAYOUT, type ColumnLayoutSpec,
} from '../webview/lenses/ncnLayout.js'

const edge = (from: string, to: string): VertoEdge => ({ from, to } as VertoEdge)
const spec: ColumnLayoutSpec = { nodeWidth: 100, nodeHeight: 20, columnGap: 10, rowGap: 5, padding: 2 }

async function elkOrder(ids: string[], edges: VertoEdge[]): Promise<Map<string, number>> {
  const layout = await new ELK().layout({
    id: 'root',
    layoutOptions: elkLayoutOptions,
    children: ids.map(id => ({ id, width: NCN_LAYOUT.nodeWidth, height: NCN_LAYOUT.nodeHeight })),
    edges: edges.map((e, i) => ({ id: `e${i}`, sources: [e.from], targets: [e.to] })),
  })
  return new Map((layout.children ?? []).map(c => [c.id, c.y ?? 0]))
}

describe('dependencyDepth', () => {
  it('chain → 0, 1, 2', () => {
    const d = dependencyDepth(['a', 'b', 'c'], [edge('a', 'b'), edge('b', 'c')])
    expect([...d]).toEqual([['a', 0], ['b', 1], ['c', 2]])
  })

  it('takes the longest path (diamond with a shortcut)', () => {
    const d = dependencyDepth(
      ['a', 'b', 'c', 'd'],
      [edge('a', 'b'), edge('b', 'c'), edge('a', 'c'), edge('c', 'd'), edge('a', 'd')],
    )
    expect(d.get('d')).toBe(3)
  })

  it('disconnected parts and isolated nodes start at 0', () => {
    const d = dependencyDepth(['a', 'b', 'x', 'y', 'solo'], [edge('a', 'b'), edge('x', 'y')])
    expect(Object.fromEntries(d)).toEqual({ a: 0, b: 1, x: 0, y: 1, solo: 0 })
  })

  it('ignores edges to unknown ids', () => {
    const d = dependencyDepth(['a'], [edge('ghost', 'a'), edge('a', 'ghost')])
    expect(d.get('a')).toBe(0)
  })

  it('terminates on a cycle', () => {
    const d = dependencyDepth(['a', 'b', 'c'], [edge('a', 'b'), edge('b', 'c'), edge('c', 'b')])
    expect(d.size).toBe(3)
    expect(d.get('a')).toBe(0)
  })
})

describe('packColumns', () => {
  it('column = depth, rows top-aligned in the given order', () => {
    const depth = new Map([['a', 0], ['b', 1], ['c', 1], ['d', 1]])
    const order = new Map([['a', 0], ['b', 50], ['c', 10], ['d', 30]])
    const { positions, columns, width, height } = packColumns(depth, order, spec)
    expect(positions.get('a')).toEqual({ x: 2, y: 2 })
    expect(positions.get('c')).toEqual({ x: 112, y: 2 })
    expect(positions.get('d')).toEqual({ x: 112, y: 27 })
    expect(positions.get('b')).toEqual({ x: 112, y: 52 })
    expect(columns).toEqual([{ x: 2, width: 100 }, { x: 112, width: 100 }])
    expect(width).toBe(2 + 100 + 10 + 100 + 2)
    expect(height).toBe(2 + 3 * 20 + 2 * 5 + 2)
  })

  it('breaks order ties by id', () => {
    const depth = new Map([['b', 0], ['a', 0]])
    const { positions } = packColumns(depth, new Map(), spec)
    expect(positions.get('a')!.y).toBeLessThan(positions.get('b')!.y)
  })
})

describe('ELK options + packing', () => {
  it('lays out disconnected parts and isolated nodes in their depth columns', async () => {
    const ids = ['a', 'b', 'c', 'x', 'y', 'solo']
    const edges = [edge('a', 'b'), edge('b', 'c'), edge('x', 'y')]
    const depth = dependencyDepth(ids, edges)
    const { positions } = packColumns(depth, await elkOrder(ids, edges), spec)
    expect(positions.size).toBe(ids.length)
    const colX = (col: number) => spec.padding + col * (spec.nodeWidth + spec.columnGap)
    expect(positions.get('solo')!.x).toBe(colX(0))
    expect(positions.get('x')!.x).toBe(colX(0))
    expect(positions.get('y')!.x).toBe(colX(1))
    expect(positions.get('c')!.x).toBe(colX(2))
  })

  it('in-column order follows ELK crossing minimisation', async () => {
    // By id alone c1 would sit above c2 and the edges p1→c2, p2→c1 would cross.
    const ids = ['p1', 'p2', 'c1', 'c2']
    const edges = [edge('p1', 'c2'), edge('p2', 'c1')]
    const { positions } = packColumns(dependencyDepth(ids, edges), await elkOrder(ids, edges), spec)
    const y = (id: string) => positions.get(id)!.y
    expect(y('p1') < y('p2')).toBe(y('c2') < y('c1'))
  })
})
