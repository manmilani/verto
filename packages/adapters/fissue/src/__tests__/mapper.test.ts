import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { pathToFileURL } from 'node:url'
import type { VertoConfig, FieldMappings } from '@verto/config'
import { mapTicketsToGraph } from '../mapper.js'
import { state, ticket } from './fixtures.js'

const cfg = (fieldMappings?: FieldMappings): VertoConfig => ({ adapter: 'fissue', fissue: { fieldMappings } })

describe('mapTicketsToGraph', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>
  beforeEach(() => { warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {}) })
  afterEach(() => { warnSpy.mockRestore() })

  const warnings = () => warnSpy.mock.calls.map(c => String(c[0]))

  it('maps system fields', () => {
    const t = ticket('P-1', { state: 'CLOSED', createdAt: '2026-01-01', subIssues: ['P-2'], blockedBy: ['P-3'] })
    const g = mapTicketsToGraph(state([t, ticket('P-2'), ticket('P-3')]), cfg())
    const n = g.nodes[0]!
    expect(n).toMatchObject({
      id: 'P-1',
      title: 'T P-1',
      isDone: true,
      isDeliverySlice: true,
      priority: 5,
      prereqIds: ['P-3', 'P-2'],
      childIds: ['P-2'],
      created_at: '2026-01-01',
      nodeType: 'ticket',
      nodeOrigin: 'fissue',
      _rawReqIds: [],
      personas: [],
    })
    expect(n.ticketUrl).toBe(pathToFileURL(t.path).href)
    expect(n.ticketUrl.startsWith('file://')).toBe(true)
    expect(g.nodes.find(x => x.id === 'P-2')!.isDeliverySlice).toBe(false)
    expect(g.nodes.find(x => x.id === 'P-2')!.isDone).toBe(false)
    expect(g.edges).toEqual([
      { from: 'P-3', to: 'P-1', reason: 'blocking' },
      { from: 'P-2', to: 'P-1', reason: 'parent-child' },
    ])
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('an empty title falls back to the id', () => {
    expect(mapTicketsToGraph(state([ticket('P-1', { title: '' })]), cfg()).nodes[0]!.title).toBe('P-1')
    expect(mapTicketsToGraph(state([ticket('P-1', { title: null })]), cfg()).nodes[0]!.title).toBe('P-1')
  })

  it('fieldMappings: body from the ticket body, values by field type, canonical routing', () => {
    const t = ticket('P-1', { status: 'In Progress', points: '0x10', labels: 'one' }, 'RAW_REQ text')
    const n = mapTicketsToGraph(state([t]), cfg({
      body: { from: { kind: 'issue', field: 'body' } },
      status: { from: { kind: 'issueField', field: 'status' }, type: 'select' },
      points: { from: { kind: 'issueField', field: 'points' } },
      labels: { from: { kind: 'issue', field: 'labels' } },
      nope: { from: { kind: 'issue', field: 'notDefined' } },
    })).nodes[0]!
    expect(n.status).toBe('In Progress')
    expect(n.ticketFields).toEqual({ body: 'RAW_REQ text', points: 16, labels: ['one'], nope: null })
  })

  it('canonical override: listed false wins; missing from values and null keep the system value', () => {
    const fm: FieldMappings = { isDeliverySlice: { from: { kind: 'issue', field: 'issueType' }, values: { Epic: true, Task: false } } }
    const nodes = mapTicketsToGraph(state([
      ticket('P-1', { issueType: 'Task' }),
      ticket('P-2', { issueType: 'Bug' }),
      ticket('P-3'),
    ]), cfg(fm)).nodes
    expect(nodes.map(n => n.isDeliverySlice)).toEqual([false, true, true])
  })

  it('drops links to unloaded tickets and self-links, logged as one line', () => {
    const g = mapTicketsToGraph(state([
      ticket('P-1', { blockedBy: ['P-1', 'P-9'], subIssues: ['P-2'] }),
      ticket('P-2'),
    ]), cfg())
    expect(g.nodes[0]!.prereqIds).toEqual(['P-2'])
    expect(g.edges).toEqual([{ from: 'P-2', to: 'P-1', reason: 'parent-child' }])
    expect(warnings()).toEqual(['[verto] fissue: 2 link(s) to unloaded or same tickets dropped: P-1.blockedBy → P-1, P-1.blockedBy → P-9'])
  })

  it('duplicate IDs: the first in list order wins', () => {
    const a = ticket('P-1', { title: 'first' })
    const b = { ...ticket('P-1', { title: 'second' }), file: 'P-1-other.md' }
    const g = mapTicketsToGraph(state([a, b, ticket('X-1')]), cfg())
    expect(g.nodes.map(n => [n.id, n.title])).toEqual([['P-1', 'first'], ['X-1', 'T X-1']])
    expect(warnings()).toEqual(['[verto] fissue: duplicate ID P-1 (P-1-other.md) skipped'])
  })

  it('personas: persona: labels by default, placeholder when mapped (text-parser fills it)', () => {
    const t = ticket('P-1', { labels: ['persona:dev', 'bug'] })
    expect(mapTicketsToGraph(state([t]), cfg()).nodes[0]!.personas).toEqual(['dev'])
    const mapped = mapTicketsToGraph(state([t]), cfg({
      personas: { from: { kind: 'issue', field: 'labels.persona' }, isArray: true },
    })).nodes[0]!
    expect(mapped.personas).toEqual([])
    expect(mapped.ticketFields).toEqual({ labels: ['persona:dev', 'bug'] })
  })

  it('priority: clamped; mapped but empty counted in one line; unmapped is silent', () => {
    const fm: FieldMappings = { priority: { from: { kind: 'issueField', field: 'points' } } }
    const nodes = mapTicketsToGraph(state([
      ticket('P-1', { points: '12' }),
      ticket('P-2'),
      ticket('P-3', { points: 'x' }),
    ]), cfg(fm)).nodes
    expect(nodes.map(n => n.priority)).toEqual([9, 5, 5])
    expect(warnings()).toEqual(['[verto] fissue: 2 ticket(s): mapped priority empty or invalid, defaulting to 5'])
  })
})
