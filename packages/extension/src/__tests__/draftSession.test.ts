import { describe, it, expect, vi } from 'vitest'
import type { VertoConfig } from '@verto/config'
import type { VertoAdapter, VertoChange, VertoGraph, VertoNode } from '@verto/core'
import type { LoadedProject } from '../host/loadPipeline.js'
import { buildView } from '../host/loadPipeline.js'
import { acceptEdit, afterWrite, invalidReason, viewWithDraft } from '../host/draftSession.js'

function node(id: string, extra: Partial<VertoNode> = {}): VertoNode {
  return {
    id, title: id, isDone: false, isDeliverySlice: true, priority: 5, prereqIds: [], childIds: [],
    ticketUrl: `file:///${id}.md`, nodeType: 'ticket', nodeOrigin: 'fake', personas: [], _rawReqIds: [], ...extra,
  }
}

function project(graph: VertoGraph, adapter: Partial<VertoAdapter<VertoConfig>> = {}): LoadedProject {
  const config = { adapter: 'fake' } as VertoConfig
  return {
    adapter: { loadProject: async () => graph, ...adapter },
    graph, config, fullConfig: config, projectName: 'p', trackerStatusOptions: [], fieldMappings: undefined, skipped: [],
  }
}

const graph = (): VertoGraph => ({
  nodes: [node('A', { ticketFields: { body: 'text' } }), node('B', { prereqIds: ['A'] })],
  edges: [{ from: 'A', to: 'B', reason: 'blocking' }],
})

const prio = (nodeId: string, value: number): VertoChange => ({ type: 'set', nodeId, key: 'priority', value })

describe('buildView', () => {
  it('builds twice from one load without changing it (bodies kept)', () => {
    const p = project(graph())
    buildView(p, [prio('A', 2)], true)
    const again = buildView(p, [], true)
    expect(p.graph.nodes[0]!.ticketFields!['body']).toBe('text')
    expect(again.bundle.graph.nodes.find(n => n.id === 'A')!.priority).toBe(5)
  })
})

describe('viewWithDraft', () => {
  it('drops no-op changes from the draft', () => {
    const { entries, pruned } = viewWithDraft(project(graph()), [{ change: prio('A', 5) }, { change: prio('B', 1) }], true)
    expect(pruned).toBe(true)
    expect(entries.map(e => e.change)).toEqual([prio('B', 1)])
  })

  it('an invalid draft falls back to its longest valid prefix; later entries are invalid', () => {
    const cycle: VertoChange = { type: 'link', nodeId: 'A', blockerId: 'B', add: true }
    const { view } = viewWithDraft(project(graph()), [{ change: prio('A', 1) }, { change: cycle }, { change: prio('B', 2) }], true)
    expect(view.changeStates.map(s => s.state)).toEqual(['applied', 'invalid', 'invalid'])
    expect(invalidReason(view)).toMatch(/cycle/)
  })
})

describe('acceptEdit', () => {
  it('refuses edits on unknown nodes, empty titles, and cycle-making links', async () => {
    const p = project(graph())
    expect(await acceptEdit(p, [], prio('Z', 1), true)).toEqual({ ok: false, error: 'Z is not a ticket in this view' })
    expect(await acceptEdit(p, [], { type: 'set', nodeId: 'A', key: 'title', value: ' ' }, true)).toEqual({ ok: false, error: 'a title is required' })
    const r = await acceptEdit(p, [], { type: 'link', nodeId: 'A', blockerId: 'B', add: true }, true)
    expect(r.ok).toBe(false)
  })

  it('points at the invalid entries already in the draft', async () => {
    const cycle: VertoChange = { type: 'link', nodeId: 'A', blockerId: 'B', add: true }
    const r = await acceptEdit(project(graph()), [{ change: cycle }], prio('B', 2), true)
    expect(r.ok === false && r.error).toMatch(/^the draft has invalid entries; discard them first: [\s\S]*cycle/)
  })

  it('refuses edits on parsed nodes', async () => {
    const g = graph()
    g.nodes.push(node('A#raw-req-1', { nodeType: 'parsed', ticketUrl: 'file:///A.md#raw-req-1', isDeliverySlice: false }))
    const r = await acceptEdit(project(g), [], prio('A#raw-req-1', 1), true)
    expect(r).toEqual({ ok: false, error: 'A#raw-req-1 is not a ticket in this view' })
  })

  it('assigns temp ids to creates, replaces by target (dropping its error), and asks a writing adapter', async () => {
    const checkChange = vi.fn(async (_c: VertoConfig, ch: VertoChange) => (ch.type === 'set' && ch.value === 9 ? 'no 9' : null))
    const p = project(graph(), { writeBack: async () => ({ failed: [], createdIds: {}, addMappings: {} }), checkChange })
    const r1 = await acceptEdit(p, [{ change: prio('A', 2), error: 'old' }], { type: 'create', nodeId: 'ignored', parentId: 'A', title: 'C' }, true)
    expect(r1.ok && r1.entries[1]!.change).toEqual({ type: 'create', nodeId: 'new:1', parentId: 'A', title: 'C' })
    const r2 = await acceptEdit(p, r1.ok ? r1.entries : [], prio('A', 3), true)
    expect(r2.ok && r2.entries[0]).toEqual({ change: prio('A', 3) })
    const r3 = await acceptEdit(p, r2.ok ? r2.entries : [], prio('new:1', 4), true)
    expect(r3.ok).toBe(true)
    expect(await acceptEdit(p, [], prio('A', 9), true)).toEqual({ ok: false, error: 'no 9' })
  })
})

describe('afterWrite', () => {
  it('keeps failed changes with remapped temp ids; shows only changed errors', () => {
    const create: VertoChange = { type: 'create', nodeId: 'new:1', parentId: 'A', title: 'C' }
    const entries = [{ change: create }, { change: prio('new:1', 2), error: 'same' }, { change: prio('B', 1) }]
    const out = afterWrite(entries, {
      failed: [{ change: prio('new:1', 2), error: 'same' }, { change: prio('B', 1), error: 'boom' }],
      createdIds: { 'new:1': 'P-9' },
      addMappings: {},
    })
    expect(out.entries).toEqual([{ change: prio('P-9', 2), error: 'same' }, { change: prio('B', 1), error: 'boom' }])
    expect(out.shown).toEqual([{ change: prio('B', 1), error: 'boom' }])
  })
})
