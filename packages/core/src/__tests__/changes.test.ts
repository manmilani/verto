import { describe, it, expect } from 'vitest'
import {
  applyChanges,
  discardChanges,
  nextTempId,
  parseChange,
  remapNodeIds,
  sameTarget,
  upsertChange,
  type EditableKey,
  type VertoChange,
} from '../changes.js'
import { validateGraph } from '../validation.js'
import { edge, graph, node } from './helpers.js'

const set = (nodeId: string, key: EditableKey, value: string | number | boolean | string[]): VertoChange =>
  ({ type: 'set', nodeId, key, value })
const link = (nodeId: string, blockerId: string, add: boolean): VertoChange => ({ type: 'link', nodeId, blockerId, add })
const create = (nodeId: string, parentId: string, title = 'New'): VertoChange => ({ type: 'create', nodeId, parentId, title })

describe('sameTarget / upsertChange', () => {
  it('matches set by node and key, link by node and blocker, create by temp id', () => {
    expect(sameTarget(set('a', 'priority', 1), set('a', 'priority', 2))).toBe(true)
    expect(sameTarget(set('a', 'priority', 1), set('a', 'title', 'x'))).toBe(false)
    expect(sameTarget(link('a', 'b', true), link('a', 'b', false))).toBe(true)
    expect(sameTarget(link('a', 'b', true), link('a', 'c', true))).toBe(false)
    expect(sameTarget(create('new:1', 'a'), create('new:1', 'b'))).toBe(true)
    expect(sameTarget(set('a', 'title', 'x'), link('a', 'b', true))).toBe(false)
  })

  it('replaces the same target in place, else appends', () => {
    const d = [set('a', 'priority', 1), set('b', 'title', 'B')]
    expect(upsertChange(d, set('a', 'priority', 3))).toEqual([set('a', 'priority', 3), set('b', 'title', 'B')])
    expect(upsertChange(d, set('c', 'isDone', true))).toHaveLength(3)
  })
})

describe('discardChanges', () => {
  it('drops everything without a list', () => {
    expect(discardChanges([set('a', 'priority', 1)])).toEqual([])
  })

  it('drops matching targets and cascades creates (temp ids contain ":")', () => {
    const d = [
      create('new:1', 'a'),
      set('new:1', 'priority', 2),
      create('new:2', 'new:1'),
      link('b', 'new:2', true),
      set('b', 'title', 'B'),
    ]
    expect(discardChanges(d, [create('new:1', 'a')])).toEqual([set('b', 'title', 'B')])
  })
})

describe('nextTempId / remapNodeIds', () => {
  it('picks one past the highest temp id', () => {
    expect(nextTempId([])).toBe('new:1')
    expect(nextTempId([create('new:3', 'a'), create('new:1', 'a'), set('x', 'title', 't')])).toBe('new:4')
  })

  it('remaps node, blocker and parent ids', () => {
    const d = [create('new:1', 'new:0'), link('new:1', 'new:0', true), set('new:1', 'title', 'x')]
    expect(remapNodeIds(d, { 'new:0': '7', 'new:1': '8' })).toEqual([
      create('8', '7'),
      link('8', '7', true),
      set('8', 'title', 'x'),
    ])
  })
})

describe('applyChanges', () => {
  const base = () => graph(
    [node('p', { childIds: ['c'], isDeliverySlice: true }), node('c'), node('b'), node('r', { nodeType: 'parsed' })],
    [edge('c', 'p', 'parent-child')],
  )

  it('sets fields, clamping priority; personas compare as sets', () => {
    const g = graph([node('a', { personas: ['x', 'y'] })])
    const { graph: out, states } = applyChanges(g, [
      set('a', 'priority', 12),
      set('a', 'title', 'T'),
      set('a', 'personas', ['y', 'x']),
      set('a', 'isDone', true),
    ])
    expect(states).toEqual(['applied', 'applied', 'noop', 'applied'])
    expect(out.nodes[0]).toMatchObject({ priority: 9, title: 'T', isDone: true })
    expect(g.nodes[0]!.title).toBe('a')
  })

  it('a set equal to the current value is a noop', () => {
    expect(applyChanges(graph([node('a')]), [set('a', 'priority', 5)]).states).toEqual(['noop'])
  })

  it('adds and removes blocking links', () => {
    const g = base()
    const added = applyChanges(g, [link('p', 'b', true)])
    expect(added.states).toEqual(['applied'])
    expect(added.graph.nodes.find(n => n.id === 'p')!.prereqIds).toEqual(['c', 'b'])
    expect(validateGraph(added.graph).valid).toBe(true)

    const removed = applyChanges(added.graph, [link('p', 'b', false)])
    expect(removed.graph.nodes.find(n => n.id === 'p')!.prereqIds).toEqual(['c'])
    expect(removed.graph.edges.some(e => e.reason === 'blocking')).toBe(false)
  })

  it('link noop tests the blocking edge, not prereqIds (a child may also block its parent)', () => {
    const { graph: out, states } = applyChanges(base(), [link('p', 'c', true)])
    expect(states).toEqual(['applied'])
    expect(validateGraph(out).valid).toBe(true)
    const back = applyChanges(out, [link('p', 'c', false)])
    expect(back.states).toEqual(['applied'])
    expect(back.graph.nodes.find(n => n.id === 'p')!.prereqIds).toEqual(['c'])
    expect(applyChanges(base(), [link('p', 'c', false)]).states).toEqual(['noop'])
  })

  it('creates a child with a placeholder URL that validates', () => {
    const { graph: out, states } = applyChanges(base(), [create('new:1', 'p', 'Child'), set('new:1', 'priority', 2)])
    expect(states).toEqual(['applied', 'applied'])
    const child = out.nodes.find(n => n.id === 'new:1')!
    expect(child).toMatchObject({ title: 'Child', priority: 2, isDeliverySlice: false, ticketUrl: 'verto-draft:new:1' })
    expect(out.nodes.find(n => n.id === 'p')!.childIds).toEqual(['c', 'new:1'])
    expect(validateGraph(out).valid).toBe(true)
  })

  it('changes needing nodes that are not loaded tickets are notLoaded', () => {
    const { states } = applyChanges(base(), [
      set('zz', 'title', 'x'),
      set('r', 'title', 'x'),
      link('p', 'r', true),
      create('new:1', 'zz'),
      set('new:1', 'title', 'y'),
    ])
    expect(states).toEqual(['notLoaded', 'notLoaded', 'notLoaded', 'notLoaded', 'notLoaded'])
  })

  it('a cycle-making link applies (validation catches it)', () => {
    const g = graph([node('a'), node('b')], [edge('a', 'b')])
    const { graph: out } = applyChanges(g, [link('a', 'b', true)])
    expect(validateGraph(out).valid).toBe(false)
  })
})

describe('parseChange', () => {
  it('accepts well-formed changes', () => {
    expect(parseChange({ type: 'set', nodeId: 'a', key: 'personas', value: ['x'] })).toEqual(set('a', 'personas', ['x']))
    expect(parseChange({ type: 'link', nodeId: 'a', blockerId: 'b', add: false })).toEqual(link('a', 'b', false))
    expect(parseChange({ type: 'create', nodeId: 'new:1', parentId: 'a', title: 'T' })).toEqual(create('new:1', 'a', 'T'))
  })

  it('rejects wrong shapes and value types', () => {
    for (const bad of [
      null,
      { type: 'set', nodeId: 'a', key: 'priority', value: '2' },
      { type: 'set', nodeId: 'a', key: 'isDone', value: 1 },
      { type: 'set', nodeId: 'a', key: 'personas', value: [1] },
      { type: 'set', nodeId: 'a', key: 'ticketUrl', value: 'x' },
      { type: 'set', nodeId: '', key: 'title', value: 'x' },
      { type: 'link', nodeId: 'a', blockerId: 'b' },
      { type: 'create', nodeId: 'new:1', title: 'x' },
      { type: 'delete', nodeId: 'a' },
    ]) {
      expect(parseChange(bad)).toBeNull()
    }
  })
})
