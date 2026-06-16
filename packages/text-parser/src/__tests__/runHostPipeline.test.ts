import { describe, it, expect, vi, afterEach } from 'vitest'
import type { VertoNode, VertoGraph } from '@verto/core'
import { runHostPipeline } from '../runHostPipeline.js'

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

const BODY_WITH_REQS = 'RAW_REQ:BEGIN\n- [ ] Req one\n- [x] Req two\nRAW_REQ:END'

describe('runHostPipeline', () => {
  it('parsedEnabled:true (default) → bundle includes parsed nodes', () => {
    const n = node({ id: 'A', title: 'A', ticketFields: { body: BODY_WITH_REQS } })
    const graph: VertoGraph = { nodes: [n], edges: [] }
    const bundle = runHostPipeline(graph)
    const parsedNodes = bundle.graph.nodes.filter(nd => nd.nodeType === 'parsed')
    expect(parsedNodes).toHaveLength(2)
  })

  it('parsedEnabled:false → parsed nodes filtered out before bundle', () => {
    const n = node({ id: 'A', title: 'A', ticketFields: { body: BODY_WITH_REQS } })
    const graph: VertoGraph = { nodes: [n], edges: [] }
    const bundle = runHostPipeline(graph, { parsedEnabled: false })
    const parsedNodes = bundle.graph.nodes.filter(nd => nd.nodeType === 'parsed')
    expect(parsedNodes).toHaveLength(0)
  })

  it('returns a DeliveryMapBundle with required fields', () => {
    const n = node({ id: 'A', title: 'A' })
    const graph: VertoGraph = { nodes: [n], edges: [] }
    const bundle = runHostPipeline(graph)
    expect(bundle).toHaveProperty('graph')
    expect(bundle).toHaveProperty('implementationOrder')
  })

  it('throws on invalid graph (dangling prereq)', () => {
    const n = node({ id: 'A', title: 'A', prereqIds: ['MISSING'], childIds: ['MISSING'] })
    const graph: VertoGraph = { nodes: [n], edges: [] }
    expect(() => runHostPipeline(graph)).toThrow('Graph validation failed')
  })

  it('warnings are emitted via console.warn but do not throw', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // A parsed node with empty ticketUrl produces a missing_ticket_url warning (not an error).
    // Pre-existing parsed nodes in the input graph are preserved by materialize (no bodies to re-parse).
    const parsedNode: VertoNode = {
      id: 'P1',
      title: 'Parsed req',
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
      ticketUrl: '',  // missing → warning, not error
    }
    const parent = node({ id: 'A', title: 'A', _rawReqIds: ['P1'], prereqIds: ['P1'] })
    const graph: VertoGraph = {
      nodes: [parent, parsedNode],
      edges: [{ from: 'P1', to: 'A', reason: 'parsed-req' }],
    }
    const bundle = runHostPipeline(graph)
    expect(warnSpy).toHaveBeenCalledWith('[verto]', expect.stringContaining('P1'))
    expect(bundle).toHaveProperty('graph')
    warnSpy.mockRestore()
  })

  it('computeBodyFields populates _note and _outcome from DESC block', () => {
    const body = [
      'Some intro text.',
      '',
      'DESC:BEGIN',
      'First paragraph of outcome.',
      '',
      'Second paragraph — should be excluded.',
      'DESC:END',
    ].join('\n')
    const n = node({ id: 'A', title: 'A', ticketFields: { body } })
    const graph: VertoGraph = { nodes: [n], edges: [] }
    const bundle = runHostPipeline(graph)
    const resultNode = bundle.graph.nodes.find(nd => nd.id === 'A')!
    expect(resultNode._note).toBe('First paragraph of outcome.')
    expect(resultNode._outcome).toBe('First paragraph of outcome.')
  })

  it('_note and _outcome are undefined when no DESC block present', () => {
    const n = node({ id: 'A', title: 'A', ticketFields: { body: 'No desc block here.' } })
    const graph: VertoGraph = { nodes: [n], edges: [] }
    const bundle = runHostPipeline(graph)
    const resultNode = bundle.graph.nodes.find(nd => nd.id === 'A')!
    expect(resultNode._note).toBeUndefined()
    expect(resultNode._outcome).toBeUndefined()
  })
})
