import { describe, it, expect } from 'vitest'
import type { VertoGraph, VertoNode } from '@verto/core'
import { applyPriorityOverlay } from '../applyPriorityOverlay.js'

function node(id: string, overrides: Partial<VertoNode> = {}): VertoNode {
  return {
    id,
    title: id,
    isDone: false,
    isDeliverySlice: false,
    priority: 5,
    prereqIds: [],
    childIds: [],
    _rawReqIds: [],
    personas: [],
    nodeType: 'ticket',
    nodeOrigin: 'test',
    ticketUrl: `https://example.com/${id}`,
    ...overrides,
  }
}

function graph(nodes: VertoNode[]): VertoGraph {
  return { nodes, edges: [] }
}

describe('applyPriorityOverlay', () => {
  it('applies a numeric override to a delivery slice', () => {
    const g = graph([node('S1', { isDeliverySlice: true, priority: 5 })])
    const result = applyPriorityOverlay(g, { S1: 3 })
    expect(result.nodes.find(n => n.id === 'S1')!.priority).toBe(3)
  })

  it('does not modify non-slice nodes', () => {
    const g = graph([node('T1', { isDeliverySlice: false, priority: 5 })])
    const result = applyPriorityOverlay(g, { T1: 2 })
    expect(result.nodes.find(n => n.id === 'T1')!.priority).toBe(5)
  })

  it('null in overlay leaves original priority unchanged', () => {
    const g = graph([node('S1', { isDeliverySlice: true, priority: 4 })])
    const result = applyPriorityOverlay(g, { S1: null })
    expect(result.nodes.find(n => n.id === 'S1')!.priority).toBe(4)
  })

  it('missing key in overlay leaves original priority unchanged', () => {
    const g = graph([node('S1', { isDeliverySlice: true, priority: 4 })])
    const result = applyPriorityOverlay(g, {})
    expect(result.nodes.find(n => n.id === 'S1')!.priority).toBe(4)
  })

  it('empty overlay is a no-op — returns structurally equivalent graph', () => {
    const g = graph([node('S1', { isDeliverySlice: true }), node('T1')])
    const result = applyPriorityOverlay(g, {})
    expect(result.nodes.map(n => n.priority)).toEqual(g.nodes.map(n => n.priority))
  })

  it('clamps overlay values to 1–9 (defensive insurance against stale workspaceState)', () => {
    const g = graph([node('S1', { isDeliverySlice: true, priority: 5 })])
    const below = applyPriorityOverlay(g, { S1: 0 })
    expect(below.nodes[0].priority).toBe(1)
    const above = applyPriorityOverlay(g, { S1: 10 })
    expect(above.nodes[0].priority).toBe(9)
  })

  it('rounds non-integer values from stale workspaceState', () => {
    const g = graph([node('S1', { isDeliverySlice: true, priority: 5 })])
    const result = applyPriorityOverlay(g, { S1: 2.7 })
    expect(result.nodes[0].priority).toBe(3)
  })

  it('returns a new graph object (immutable)', () => {
    const g = graph([node('S1', { isDeliverySlice: true })])
    const result = applyPriorityOverlay(g, { S1: 2 })
    expect(result).not.toBe(g)
    expect(result.nodes).not.toBe(g.nodes)
  })

  it('returns the same graph object when no changes are made', () => {
    // When no slice is in the overlay, nodes array reference is new but values are unchanged
    const g = graph([node('T1')])
    const result = applyPriorityOverlay(g, {})
    expect(result.nodes.every((n, i) => n === g.nodes[i])).toBe(true)
  })
})
