import { describe, it, expect } from 'vitest'
import type { VertoNode, VertoGraph } from '@verto/core'
import { validateGraph } from '@verto/core'
import { filterParsedNodes } from '../filter.js'

function node(overrides: Partial<VertoNode> & { id: string; title: string }): VertoNode {
  return {
    isDone: false,
    isDeliverySlice: false,
    priority: 5,
    prereqIds: [],
    childIds: [],
    _rawReqIds: [],
    personas: [],
    nodeType: 'ticket',
    nodeOrigin: 'test',
    status: undefined,
    ticketUrl: `https://example.com/${overrides.id}`,
    ...overrides,
  }
}

function parsedNode(id: string, parentId: string): VertoNode {
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
    nodeType: 'parsed',
    nodeOrigin: 'text-parser',
    status: 'raw',
    ticketUrl: `https://example.com/${parentId}#${id}`,
  }
}

describe('filterParsedNodes', () => {
  it('does not mutate input graph', () => {
    const ticket = node({ id: 'A', title: 'A', _rawReqIds: ['A#raw-req-1'] })
    const parsed = parsedNode('A#raw-req-1', 'A')
    const original: VertoGraph = {
      nodes: [ticket, parsed],
      edges: [{ from: 'A#raw-req-1', to: 'A', reason: 'parsed-req' }],
    }
    const originalNodes = [...original.nodes]
    filterParsedNodes(original)
    expect(original.nodes).toHaveLength(2)
    expect(original.nodes[0]).toBe(originalNodes[0])
    expect(original.nodes[1]).toBe(originalNodes[1])
  })

  it('removes parsed nodes', () => {
    const ticket = node({ id: 'A', title: 'A', _rawReqIds: ['A#raw-req-1'] })
    const parsed = parsedNode('A#raw-req-1', 'A')
    const graph: VertoGraph = {
      nodes: [ticket, parsed],
      edges: [{ from: 'A#raw-req-1', to: 'A', reason: 'parsed-req' }],
    }
    const result = filterParsedNodes(graph)
    expect(result.nodes.every(n => n.nodeType !== 'parsed')).toBe(true)
    expect(result.nodes).toHaveLength(1)
  })

  it('removes parsed-req edges', () => {
    const ticket = node({ id: 'A', title: 'A', _rawReqIds: ['A#raw-req-1'] })
    const parsed = parsedNode('A#raw-req-1', 'A')
    const graph: VertoGraph = {
      nodes: [ticket, parsed],
      edges: [
        { from: 'A#raw-req-1', to: 'A', reason: 'parsed-req' },
        { from: 'C', to: 'A', reason: 'blocking' },
      ],
    }
    const result = filterParsedNodes(graph)
    expect(result.edges.every(e => e.reason !== 'parsed-req')).toBe(true)
    expect(result.edges).toHaveLength(1)
    expect(result.edges[0].reason).toBe('blocking')
  })

  it('clears _rawReqIds on remaining nodes', () => {
    const ticket = node({ id: 'A', title: 'A', _rawReqIds: ['A#raw-req-1'] })
    const parsed = parsedNode('A#raw-req-1', 'A')
    const graph: VertoGraph = {
      nodes: [ticket, parsed],
      edges: [{ from: 'A#raw-req-1', to: 'A', reason: 'parsed-req' }],
    }
    const result = filterParsedNodes(graph)
    const remaining = result.nodes.find(n => n.id === 'A')!
    expect(remaining._rawReqIds).toEqual([])
  })

  it('recomputes prereqIds from childIds and blocking edges only', () => {
    const child = node({ id: 'C', title: 'Child' })
    const blocker = node({ id: 'B', title: 'Blocker' })
    const ticket = node({
      id: 'A',
      title: 'A',
      childIds: ['C'],
      _rawReqIds: ['A#raw-req-1'],
      prereqIds: ['C', 'B', 'A#raw-req-1'],
    })
    const parsed = parsedNode('A#raw-req-1', 'A')
    const graph: VertoGraph = {
      nodes: [ticket, child, blocker, parsed],
      edges: [
        { from: 'C', to: 'A', reason: 'parent-child' },
        { from: 'B', to: 'A', reason: 'blocking' },
        { from: 'A#raw-req-1', to: 'A', reason: 'parsed-req' },
      ],
    }
    const result = filterParsedNodes(graph)
    const remaining = result.nodes.find(n => n.id === 'A')!
    expect(new Set(remaining.prereqIds)).toEqual(new Set(['C', 'B']))
  })

  it('ticket nodes and blocking/parent-child edges are untouched', () => {
    const ticket = node({ id: 'A', title: 'A' })
    const other = node({ id: 'B', title: 'B' })
    const graph: VertoGraph = {
      nodes: [ticket, other],
      edges: [{ from: 'B', to: 'A', reason: 'blocking' }],
    }
    const result = filterParsedNodes(graph)
    expect(result.nodes).toHaveLength(2)
    expect(result.edges).toHaveLength(1)
    expect(result.edges[0].reason).toBe('blocking')
  })

  it('no-op filter on ticket-only graph still returns new node objects', () => {
    const ticket = node({ id: 'A', title: 'A' })
    const graph: VertoGraph = { nodes: [ticket], edges: [] }
    const result = filterParsedNodes(graph)
    expect(result.nodes[0]).not.toBe(ticket)
    expect(result.nodes[0].id).toBe('A')
  })

  it('validateGraph on filtered result has no errors', () => {
    const child = node({ id: 'C', title: 'Child' })
    const ticket = node({
      id: 'A',
      title: 'A',
      childIds: ['C'],
      _rawReqIds: ['A#raw-req-1'],
      prereqIds: ['C', 'A#raw-req-1'],
    })
    const parsed = parsedNode('A#raw-req-1', 'A')
    const graph: VertoGraph = {
      nodes: [ticket, child, parsed],
      edges: [
        { from: 'C', to: 'A', reason: 'parent-child' },
        { from: 'A#raw-req-1', to: 'A', reason: 'parsed-req' },
      ],
    }
    const result = filterParsedNodes(graph)
    const validation = validateGraph(result)
    expect(validation.errors).toHaveLength(0)
  })
})
