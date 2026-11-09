import { describe, it, expect } from 'vitest'
import { buildDeliveryMapBundle, type VertoGraph, type VertoNode } from '@verto/core'
import { focusSet, isDimmed, servedSlices } from '../webview/focusSet.js'

function node(id: string, prereqIds: string[] = [], isDeliverySlice = false): VertoNode {
  return {
    id, title: id, isDone: false, isDeliverySlice, priority: 5, prereqIds, childIds: [],
    _rawReqIds: [], personas: [], nodeType: 'ticket', nodeOrigin: 'test', status: undefined,
  }
}

function graph(nodes: VertoNode[]): VertoGraph {
  return {
    nodes,
    edges: nodes.flatMap(n => n.prereqIds.map(from => ({ from, to: n.id, reason: 'blocking' as const }))),
  }
}

// A → B → C → D, X → C, Y unrelated
const g = graph([
  node('A'), node('B', ['A']), node('X'), node('C', ['B', 'X']), node('D', ['C']), node('Y'),
])

describe('focusSet', () => {
  it('no id or unknown id → no focus', () => {
    expect(focusSet(g)).toBeUndefined()
    expect(focusSet(g, 'nope')).toBeUndefined()
  })

  it('upstream closure, itself included, plus direct dependents only', () => {
    expect(focusSet(g, 'B')).toEqual(new Set(['A', 'B', 'C']))
    expect(focusSet(g, 'C')).toEqual(new Set(['A', 'B', 'X', 'C', 'D']))
  })

  it('a dependent that is also in the closure (cycle) is counted once', () => {
    const cyc = graph([node('P', ['Q']), node('Q', ['P']), node('R', ['Q'])])
    expect(focusSet(cyc, 'P')).toEqual(new Set(['P', 'Q']))
    expect(focusSet(cyc, 'Q')).toEqual(new Set(['P', 'Q', 'R']))
  })

  it("a journey's set = the nodes serving it plus its direct dependents", () => {
    const j = graph([
      node('A'), node('B', ['A']), node('J', ['B'], true), node('K', ['J']), node('Y'),
    ])
    const bundle = buildDeliveryMapBundle(j)
    const serving = j.nodes.filter(n => bundle.servedBySliceIds?.[n.id]?.includes('J')).map(n => n.id)
    expect(focusSet(j, 'J')).toEqual(new Set([...serving, 'K']))
  })

  it('isDimmed: nothing dimmed without a focus', () => {
    const set = focusSet(g, 'B')
    expect(isDimmed(set, 'Y')).toBe(true)
    expect(isDimmed(set, 'A')).toBe(false)
    expect(isDimmed(undefined, 'Y')).toBe(false)
  })
})

describe('servedSlices', () => {
  it('drops the node itself', () => {
    const j = graph([node('A'), node('J', ['A'], true)])
    const bundle = buildDeliveryMapBundle(j)
    expect(servedSlices(bundle, 'J')).toEqual([])
    expect(servedSlices(bundle, 'A')).toEqual(['J'])
  })
})
