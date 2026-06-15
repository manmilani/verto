import { describe, it, expect } from 'vitest'
import type { VertoNode, VertoGraph } from '@verto/core'
import { validateGraph } from '@verto/core'
import { materializeParsedRequirements } from '../materialize.js'

function node(overrides: Partial<VertoNode> & { id: string; title: string }): VertoNode {
  return {
    isDone: false,
    isDeliverySlice: false,
    priority: 5,
    prereqIds: [],
    childIds: [],
    parsedReqs: [],
    personas: [],
    nodeType: 'ticket',
    nodeOrigin: 'test',
    status: undefined,
    ticketUrl: `https://example.com/${overrides.id}`,
    ...overrides,
  }
}

function ticketWithBody(id: string, body: string, extra: Partial<VertoNode> = {}): VertoNode {
  return node({ id, title: id, ticketFields: { body }, ...extra })
}

const SIMPLE_BODY = [
  'RAW_REQ:BEGIN',
  '- [ ] "First req": description one',
  '- [x] Plain done req',
  'RAW_REQ:END',
].join('\n')

describe('materializeParsedRequirements', () => {
  it('does not mutate the input graph', () => {
    const n = ticketWithBody('A', SIMPLE_BODY)
    const original: VertoGraph = { nodes: [n], edges: [] }
    const originalNodeRef = original.nodes[0]
    materializeParsedRequirements(original)
    expect(original.nodes[0]).toBe(originalNodeRef)
    expect(original.nodes).toHaveLength(1)
    expect(original.edges).toHaveLength(0)
  })

  it('returns unchanged graph structure for ticket with no body', () => {
    const n = node({ id: 'A', title: 'A' })
    const graph: VertoGraph = { nodes: [n], edges: [] }
    const result = materializeParsedRequirements(graph)
    expect(result.nodes).toHaveLength(1)
    expect(result.edges).toHaveLength(0)
  })

  it('creates parsed nodes from RAW_REQ block', () => {
    const n = ticketWithBody('A', SIMPLE_BODY)
    const graph: VertoGraph = { nodes: [n], edges: [] }
    const result = materializeParsedRequirements(graph)

    const parsedNodes = result.nodes.filter(nd => nd.nodeType === 'parsed')
    expect(parsedNodes).toHaveLength(2)
    expect(parsedNodes[0].id).toBe('A#raw-req-1')
    expect(parsedNodes[0].title).toBe('First req')
    expect(parsedNodes[0].isDone).toBe(false)
    expect(parsedNodes[0].status).toBe('raw')
    expect(parsedNodes[1].id).toBe('A#raw-req-2')
    expect(parsedNodes[1].isDone).toBe(true)
    expect(parsedNodes[1].status).toBe('done')
  })

  it('adds parsed-req edges', () => {
    const n = ticketWithBody('A', SIMPLE_BODY)
    const graph: VertoGraph = { nodes: [n], edges: [] }
    const result = materializeParsedRequirements(graph)

    const parsedEdges = result.edges.filter(e => e.reason === 'parsed-req')
    expect(parsedEdges).toHaveLength(2)
    expect(parsedEdges[0]).toEqual({ from: 'A#raw-req-1', to: 'A', reason: 'parsed-req' })
    expect(parsedEdges[1]).toEqual({ from: 'A#raw-req-2', to: 'A', reason: 'parsed-req' })
  })

  it('updates parent parsedReqs', () => {
    const n = ticketWithBody('A', SIMPLE_BODY)
    const graph: VertoGraph = { nodes: [n], edges: [] }
    const result = materializeParsedRequirements(graph)

    const parent = result.nodes.find(nd => nd.id === 'A')!
    expect(parent.parsedReqs).toEqual(['A#raw-req-1', 'A#raw-req-2'])
  })

  it('recomputes prereqIds for parent', () => {
    const n = ticketWithBody('A', SIMPLE_BODY)
    const graph: VertoGraph = { nodes: [n], edges: [] }
    const result = materializeParsedRequirements(graph)

    const parent = result.nodes.find(nd => nd.id === 'A')!
    expect(parent.prereqIds).toEqual(['A#raw-req-1', 'A#raw-req-2'])
  })

  it('recomputes prereqIds including existing childIds and blocking edges', () => {
    const child = node({ id: 'C', title: 'Child' })
    const blocker = node({ id: 'B', title: 'Blocker' })
    const parent = ticketWithBody('A', 'RAW_REQ:BEGIN\n- [ ] Req\nRAW_REQ:END', {
      childIds: ['C'],
      prereqIds: ['C', 'B'],
    })
    const graph: VertoGraph = {
      nodes: [parent, child, blocker],
      edges: [
        { from: 'C', to: 'A', reason: 'parent-child' },
        { from: 'B', to: 'A', reason: 'blocking' },
      ],
    }
    const result = materializeParsedRequirements(graph)
    const updated = result.nodes.find(nd => nd.id === 'A')!
    expect(new Set(updated.prereqIds)).toEqual(new Set(['C', 'B', 'A#raw-req-1']))
  })

  it('parsed nodes have correct metadata', () => {
    const n = ticketWithBody('A', 'RAW_REQ:BEGIN\n- [ ] Req\nRAW_REQ:END')
    const graph: VertoGraph = { nodes: [n], edges: [] }
    const result = materializeParsedRequirements(graph)

    const parsedNode = result.nodes.find(nd => nd.id === 'A#raw-req-1')!
    expect(parsedNode.priority).toBe(5)
    expect(parsedNode.nodeOrigin).toBe('parsed-nodes')
    expect(parsedNode.nodeType).toBe('parsed')
    expect(parsedNode.prereqIds).toEqual([])
    expect(parsedNode.childIds).toEqual([])
    expect(parsedNode.parsedReqs).toEqual([])
    expect(parsedNode.personas).toEqual([])
    expect(parsedNode.isDeliverySlice).toBe(false)
  })

  it('parsed node ticketUrl is parent URL + #raw-req-n', () => {
    const n = ticketWithBody('A', 'RAW_REQ:BEGIN\n- [ ] Req\nRAW_REQ:END')
    n.ticketUrl = 'https://github.com/owner/repo/issues/42'
    const graph: VertoGraph = { nodes: [n], edges: [] }
    const result = materializeParsedRequirements(graph)

    const parsedNode = result.nodes.find(nd => nd.id === 'A#raw-req-1')!
    expect(parsedNode.ticketUrl).toBe('https://github.com/owner/repo/issues/42#raw-req-1')
  })

  it('ticketFields.note set when note is present (Pattern A)', () => {
    const body = 'RAW_REQ:BEGIN\n- [ ] "Name": my note\nRAW_REQ:END'
    const n = ticketWithBody('A', body)
    const graph: VertoGraph = { nodes: [n], edges: [] }
    const result = materializeParsedRequirements(graph)

    const parsedNode = result.nodes.find(nd => nd.id === 'A#raw-req-1')!
    expect(parsedNode.ticketFields?.['note']).toBe('my note')
  })

  it('ticketFields.note set when Pattern B (name === note)', () => {
    const body = 'RAW_REQ:BEGIN\n- [ ] plain text\nRAW_REQ:END'
    const n = ticketWithBody('A', body)
    const graph: VertoGraph = { nodes: [n], edges: [] }
    const result = materializeParsedRequirements(graph)

    const parsedNode = result.nodes.find(nd => nd.id === 'A#raw-req-1')!
    expect(parsedNode.ticketFields?.['note']).toBe('plain text')
  })

  it('two parents have independent id namespaces', () => {
    const body = 'RAW_REQ:BEGIN\n- [ ] Req\nRAW_REQ:END'
    const n1 = ticketWithBody('A', body)
    const n2 = ticketWithBody('B', body)
    const graph: VertoGraph = { nodes: [n1, n2], edges: [] }
    const result = materializeParsedRequirements(graph)

    const ids = result.nodes.filter(nd => nd.nodeType === 'parsed').map(nd => nd.id)
    expect(ids).toContain('A#raw-req-1')
    expect(ids).toContain('B#raw-req-1')
    expect(ids).toHaveLength(2)
  })

  it('validateGraph on materialized result has no prereqs_consistency or parsedReqs_integrity errors', () => {
    const n = ticketWithBody('A', SIMPLE_BODY)
    const graph: VertoGraph = { nodes: [n], edges: [] }
    const result = materializeParsedRequirements(graph)
    const validation = validateGraph(result)
    const relevantErrors = validation.errors.filter(
      e => e.type === 'prereqs_consistency' || e.type === 'parsedReqs_integrity',
    )
    expect(relevantErrors).toHaveLength(0)
  })
})
