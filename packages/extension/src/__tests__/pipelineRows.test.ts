import { describe, it, expect } from 'vitest'
import { buildPipelineForSlice } from '../webview/pipelineRows.js'
import type { VertoGraph, VertoNode } from '@verto/core'

function makeNode(overrides: Partial<VertoNode> & Pick<VertoNode, 'id'>): VertoNode {
  return {
    title: overrides.id,
    isDone: false,
    isDeliverySlice: false,
    priority: 5,
    prereqIds: [],
    childIds: [],
    personas: [],
    _rawReqIds: [],
    nodeType: 'ticket',
    nodeOrigin: 'test',
    ticketUrl: `https://example.com/${overrides.id}`,
    ...overrides,
  }
}

const slice = makeNode({
  id: 'slice',
  isDeliverySlice: true,
  childIds: ['c1', 'c2', 'c3'],
  _rawReqIds: ['r1', 'r2'],
})

const c1 = makeNode({ id: 'c1', created_at: '2024-01-01' })
const c2 = makeNode({ id: 'c2', created_at: '2024-01-03' })
const c3 = makeNode({ id: 'c3', created_at: '2024-01-02' })
const r1 = makeNode({ id: 'r1', nodeType: 'parsed', nodeOrigin: 'text-parser', ticketUrl: 'https://example.com/slice#raw-req-1' })
const r2 = makeNode({ id: 'r2', nodeType: 'parsed', nodeOrigin: 'text-parser', ticketUrl: 'https://example.com/slice#raw-req-2' })

const graph: VertoGraph = {
  nodes: [slice, c1, c2, c3, r1, r2],
  edges: [],
}

describe('buildPipelineForSlice', () => {
  it('returns empty array for unknown slice id', () => {
    expect(buildPipelineForSlice('unknown', graph, [])).toEqual([])
  })

  it('sorts children by implementation order position', () => {
    // c3 is position 0, c1 is position 1, c2 is position 2
    const order = ['c3', 'c1', 'c2']
    const result = buildPipelineForSlice('slice', graph, order)
    expect(result.map(n => n.id)).toEqual(['c3', 'c1', 'c2', 'r1', 'r2'])
  })

  it('nodes absent from impl order sort last among children', () => {
    const order = ['c1']  // c2, c3 not in order → sort last
    const result = buildPipelineForSlice('slice', graph, order)
    expect(result[0].id).toBe('c1')
    // c2 and c3 should come after c1; sorted by created_at (c3=01-02, c2=01-03)
    expect(result[1].id).toBe('c3')
    expect(result[2].id).toBe('c2')
  })

  it('tie-breaks by created_at ascending when impl order positions equal', () => {
    const order: string[] = []  // all absent → all sort by created_at
    const result = buildPipelineForSlice('slice', graph, order)
    // c1=2024-01-01, c3=2024-01-02, c2=2024-01-03
    expect(result.slice(0, 3).map(n => n.id)).toEqual(['c1', 'c3', 'c2'])
  })

  it('tie-breaks by id alphanumeric when created_at also equal', () => {
    const nodeA = makeNode({ id: 'a', created_at: '2024-01-01' })
    const nodeB = makeNode({ id: 'b', created_at: '2024-01-01' })
    const sliceAB = makeNode({ id: 's', isDeliverySlice: true, childIds: ['b', 'a'] })
    const g: VertoGraph = { nodes: [sliceAB, nodeA, nodeB], edges: [] }
    const result = buildPipelineForSlice('s', g, [])
    expect(result.map(n => n.id)).toEqual(['a', 'b'])
  })

  it('appends raw requirement nodes after children in _rawReqIds order', () => {
    const order = ['c1', 'c2', 'c3']
    const result = buildPipelineForSlice('slice', graph, order)
    expect(result.slice(-2).map(n => n.id)).toEqual(['r1', 'r2'])
  })

  it('skips child ids not present in the graph', () => {
    const s = makeNode({ id: 's', isDeliverySlice: true, childIds: ['c1', 'missing'] })
    const g: VertoGraph = { nodes: [s, c1], edges: [] }
    const result = buildPipelineForSlice('s', g, [])
    expect(result.map(n => n.id)).toEqual(['c1'])
  })

  it('returns only raw nodes when slice has no children', () => {
    const s = makeNode({ id: 's', isDeliverySlice: true, childIds: [], _rawReqIds: ['r1'] })
    const g: VertoGraph = { nodes: [s, r1], edges: [] }
    const result = buildPipelineForSlice('s', g, [])
    expect(result).toEqual([r1])
  })
})
