import { describe, it, expect, vi, afterEach } from 'vitest'
import type { VertoNode, VertoGraph } from '@verto/core'
import type { FieldMappings } from '@verto/config'
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
    const bundle = runHostPipeline(graph).bundle
    const parsedNodes = bundle.graph.nodes.filter(nd => nd.nodeType === 'parsed')
    expect(parsedNodes).toHaveLength(2)
  })

  it('parsedEnabled:false → parsed nodes filtered out before bundle', () => {
    const n = node({ id: 'A', title: 'A', ticketFields: { body: BODY_WITH_REQS } })
    const graph: VertoGraph = { nodes: [n], edges: [] }
    const bundle = runHostPipeline(graph, { parsedEnabled: false }).bundle
    const parsedNodes = bundle.graph.nodes.filter(nd => nd.nodeType === 'parsed')
    expect(parsedNodes).toHaveLength(0)
  })

  it('returns a DeliveryMapBundle with required fields', () => {
    const n = node({ id: 'A', title: 'A' })
    const graph: VertoGraph = { nodes: [n], edges: [] }
    const bundle = runHostPipeline(graph).bundle
    expect(bundle).toHaveProperty('graph')
    expect(bundle).toHaveProperty('implementationOrder')
  })

  it('throws on invalid graph (dangling prereq)', () => {
    const n = node({ id: 'A', title: 'A', prereqIds: ['MISSING'], childIds: ['MISSING'] })
    const graph: VertoGraph = { nodes: [n], edges: [] }
    expect(() => runHostPipeline(graph).bundle).toThrow('Graph validation failed')
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
    const bundle = runHostPipeline(graph).bundle
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
    const bundle = runHostPipeline(graph).bundle
    const resultNode = bundle.graph.nodes.find(nd => nd.id === 'A')!
    expect(resultNode._note).toBe('First paragraph of outcome.')
    expect(resultNode._outcome).toBe('First paragraph of outcome.')
  })

  it('_note and _outcome are undefined when no DESC block present', () => {
    const n = node({ id: 'A', title: 'A', ticketFields: { body: 'No desc block here.' } })
    const graph: VertoGraph = { nodes: [n], edges: [] }
    const bundle = runHostPipeline(graph).bundle
    const resultNode = bundle.graph.nodes.find(nd => nd.id === 'A')!
    expect(resultNode._note).toBeUndefined()
    expect(resultNode._outcome).toBeUndefined()
  })

  it('changes: the draft is applied and reported per change', () => {
    const s = node({ id: 'S', title: 'Slice', isDeliverySlice: true, priority: 5 })
    const graph: VertoGraph = { nodes: [s], edges: [] }
    const before = runHostPipeline(graph).bundle
    const { bundle, changeStates } = runHostPipeline(graph, {
      changes: [
        { type: 'set', nodeId: 'S', key: 'priority', value: 2 },
        { type: 'set', nodeId: 'S', key: 'title', value: 'Slice' },
        { type: 'set', nodeId: 'X', key: 'title', value: 'x' },
      ],
    })
    expect(bundle.graph.nodes.find(n => n.id === 'S')!.priority).toBe(2)
    expect(bundle.globalPriorityRanking!['S']).not.toBe(before.globalPriorityRanking!['S'])
    expect(changeStates).toEqual([{ state: 'applied' }, { state: 'noop' }, { state: 'notLoaded' }])
    expect(graph.nodes[0]!.priority).toBe(5)
  })

  it('changes: applied after parsed mappings, so a drafted personas value wins', () => {
    const n = node({ id: 'A', title: 'A', ticketFields: { labels: ['persona:engineer'] } })
    const fieldMappings: FieldMappings = {
      personas: { from: { kind: 'issue', field: 'labels.persona' }, isArray: true },
    }
    const { bundle } = runHostPipeline({ nodes: [n], edges: [] }, {
      fieldMappings,
      changes: [{ type: 'set', nodeId: 'A', key: 'personas', value: ['pm'] }],
    })
    expect(bundle.graph.nodes[0]!.personas).toEqual(['pm'])
  })

  it('changes: a set moves the other keys mapped from the same tracker field', () => {
    const n = node({ id: 'A', title: 'A', status: 'Todo', isDone: false })
    const fieldMappings: FieldMappings = {
      status: { from: { kind: 'issueField', field: 'status' } },
      isDone: { from: { kind: 'issueField', field: 'status' }, values: { Todo: false, Done: true }, type: 'boolean' },
    }
    const run = (key: 'status' | 'isDone', value: string | boolean) =>
      runHostPipeline({ nodes: [n], edges: [] }, { fieldMappings, changes: [{ type: 'set', nodeId: 'A', key, value }] })
        .bundle.graph.nodes[0]!
    expect(run('status', 'Done')).toMatchObject({ status: 'Done', isDone: true })
    expect(run('isDone', true)).toMatchObject({ status: 'Done', isDone: true })
    expect(run('status', 'Doing')).toMatchObject({ status: 'Doing', isDone: false })
  })

  it('changes: a draft that breaks validation falls back to its longest valid prefix', () => {
    const a = node({ id: 'A', title: 'A' })
    const b = node({ id: 'B', title: 'B', prereqIds: ['A'] })
    const graph: VertoGraph = { nodes: [a, b], edges: [{ from: 'A', to: 'B', reason: 'blocking' }] }
    const { bundle, changeStates } = runHostPipeline(graph, {
      changes: [
        { type: 'set', nodeId: 'A', key: 'priority', value: 1 },
        { type: 'link', nodeId: 'A', blockerId: 'B', add: true },
        { type: 'set', nodeId: 'B', key: 'priority', value: 2 },
      ],
    })
    expect(changeStates.map(s => s.state)).toEqual(['applied', 'invalid', 'invalid'])
    expect(changeStates[1]!.error).toContain('cycle')
    expect(bundle.graph.nodes.find(n => n.id === 'A')!.priority).toBe(1)
    expect(bundle.graph.nodes.find(n => n.id === 'B')!.priority).toBe(5)
  })

  it('fieldMappings: personas populated from labels.persona via two-phase pipeline', () => {
    // Simulates what the adapter produces: personas placeholder [] + labels in ticketFields
    const n = node({
      id: 'A',
      title: 'A',
      personas: [],  // adapter placeholder when fieldMappings.personas exists
      ticketFields: { labels: ['persona:engineer', 'persona:designer', 'bug'] },
    })
    const graph: VertoGraph = { nodes: [n], edges: [] }
    const fieldMappings: FieldMappings = {
      personas: { from: { kind: 'issue', field: 'labels.persona' }, isArray: true },
    }
    const bundle = runHostPipeline(graph, { fieldMappings }).bundle
    const result = bundle.graph.nodes.find(nd => nd.id === 'A')!
    expect(result.personas).toEqual(['engineer', 'designer'])
  })

  it('fieldMappings: single persona label produces string[] not scalar', () => {
    const n = node({
      id: 'A',
      title: 'A',
      personas: [],
      ticketFields: { labels: ['persona:admin', 'bug'] },
    })
    const graph: VertoGraph = { nodes: [n], edges: [] }
    const fieldMappings: FieldMappings = {
      personas: { from: { kind: 'issue', field: 'labels.persona' }, isArray: true },
    }
    const bundle = runHostPipeline(graph, { fieldMappings }).bundle
    const result = bundle.graph.nodes.find(nd => nd.id === 'A')!
    expect(Array.isArray(result.personas)).toBe(true)
    expect(result.personas).toEqual(['admin'])
  })

  it('fieldMappings: absent labels base field leaves personas at [] (no crash)', () => {
    const n = node({ id: 'A', title: 'A', personas: [] })  // no ticketFields.labels
    const graph: VertoGraph = { nodes: [n], edges: [] }
    const fieldMappings: FieldMappings = {
      personas: { from: { kind: 'issue', field: 'labels.persona' }, isArray: true },
    }
    const bundle = runHostPipeline(graph, { fieldMappings }).bundle
    expect(bundle.graph.nodes.find(nd => nd.id === 'A')!.personas).toEqual([])
  })

  it('fieldMappings: body.PHASE extracted to ticketFields', () => {
    const body = '<!-- PHASE:BEGIN -->\nalpha\n<!-- PHASE:END -->'
    const n = node({ id: 'A', title: 'A', ticketFields: { body } })
    const graph: VertoGraph = { nodes: [n], edges: [] }
    const fieldMappings: FieldMappings = {
      phase: { from: { kind: 'issue', field: 'body.PHASE' } },
    }
    const bundle = runHostPipeline(graph, { fieldMappings }).bundle
    expect(bundle.graph.nodes.find(nd => nd.id === 'A')!.ticketFields!['phase']).toBe('alpha')
  })

  it('fieldMappings: kind:projectV2 dot-notation flows through pipeline (adapter-produced ticketFields)', () => {
    // Simulates what ProjectFieldAccessor produces for kind:'projectV2' dot-notation:
    // auto-include puts the base field value (from fieldValues) into ticketFields,
    // then runHostPipeline extracts the sub-field via applyParsedFieldMappings.
    const body = 'PHASE:BEGIN\nbeta\nPHASE:END'
    const n = node({ id: 'A', title: 'A', ticketFields: { body } })
    const graph: VertoGraph = { nodes: [n], edges: [] }
    const fieldMappings: FieldMappings = {
      phase: { from: { kind: 'projectV2', field: 'body.PHASE' } },
    }
    const bundle = runHostPipeline(graph, { fieldMappings }).bundle
    expect(bundle.graph.nodes.find(nd => nd.id === 'A')!.ticketFields!['phase']).toBe('beta')
  })

  it('fieldMappings: no fieldMappings option → applyParsedFieldMappings not called (noop)', () => {
    const n = node({ id: 'A', title: 'A', personas: [], ticketFields: { labels: ['persona:admin'] } })
    const graph: VertoGraph = { nodes: [n], edges: [] }
    const bundle = runHostPipeline(graph).bundle  // no fieldMappings
    // Without fieldMappings, personas stays at adapter placeholder []
    expect(bundle.graph.nodes.find(nd => nd.id === 'A')!.personas).toEqual([])
  })
})
