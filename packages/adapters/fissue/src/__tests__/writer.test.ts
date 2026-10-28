import { describe, expect, it, vi } from 'vitest'
import type { VertoChange, WriteConfirmation } from '@verto/core'
import type { FieldMappings, VertoConfig } from '@verto/config'
import { checkChange, writeChanges } from '../writer.js'
import { FissueAdapter } from '../adapter.js'
import { fissueAdapterDefaults } from '../defaults.js'
import { fakeApi, fissueConfig, state, ticket } from './fixtures.js'
import type { FissueProjectState } from '../system_types.js'

const defaults = fissueAdapterDefaults.fissue!.fieldMappings!

function project(): FissueProjectState {
  return state([
    ticket('A', { labels: ['bug', 'persona:dev'], status: 'Todo' }),
    ticket('B', { blockedBy: ['C'] }),
    ticket('C'),
  ])
}

const yes = { confirm: vi.fn(async (_: WriteConfirmation) => true) }

async function write(changes: VertoChange[], opts: { mappings?: FieldMappings; s?: FissueProjectState; confirm?: boolean } = {}) {
  const s = opts.s ?? project()
  const api = fakeApi(s)
  const confirm = vi.fn(async (_: WriteConfirmation) => opts.confirm ?? true)
  const result = await writeChanges(api, '/proj', opts.mappings ?? defaults, s, changes, { confirm })
  return { api, result, confirm }
}

const set = (nodeId: string, key: 'title' | 'priority' | 'status' | 'isDone' | 'personas', value: unknown): VertoChange =>
  ({ type: 'set', nodeId, key, value } as VertoChange)

describe('fissue writeChanges', () => {
  it('writes mapped, system and dot values, merged into one update per ticket', async () => {
    const { api, result } = await write([
      set('A', 'status', 'Done'),
      set('A', 'title', 'New A'),
      set('A', 'isDone', true),
      set('A', 'personas', ['pm']),
    ])
    expect(result.failed).toEqual([])
    expect(api.updates).toEqual([{
      ref: 'A',
      input: {
        set: { status: 'Done', title: 'New A', state: 'CLOSED' },
        remove: { labels: ['persona:dev'] },
        add: { labels: ['persona:pm'] },
      },
    }])
  })

  it('writes the first tracker value that reads back through values', async () => {
    const mappings: FieldMappings = {
      ...defaults,
      isDone: { from: { kind: 'issueField', field: 'status' }, values: { Todo: false, Done: true }, type: 'boolean' },
    }
    const { api, result } = await write([set('A', 'isDone', true), set('A', 'status', 'Done')], { mappings })
    expect(result.failed).toEqual([])
    expect(api.updates[0]!.input).toEqual({ set: { status: 'Done' } })
  })

  it('fails conflicting changes and merges the rest', async () => {
    const mappings: FieldMappings = {
      ...defaults,
      isDone: { from: { kind: 'issueField', field: 'status' }, values: { Todo: false, Done: true }, type: 'boolean' },
    }
    const changes = [set('A', 'status', 'Todo'), set('A', 'isDone', true), set('A', 'title', 'x')]
    const { api, result } = await write(changes, { mappings })
    expect(result.failed.map(f => f.error)).toEqual(['conflicting changes to status', 'conflicting changes to status'])
    expect(api.updates).toEqual([{ ref: 'A', input: { set: { title: 'x' } } }])
  })

  it('two dot entries on one label prefix conflict unless they agree; distinct dot entries merge', async () => {
    const clash: FieldMappings = { ...defaults, status: { from: { kind: 'issue', field: 'labels.persona' } } }
    const r1 = await write([set('A', 'personas', ['pm']), set('A', 'status', 'dev')], { mappings: clash })
    expect(r1.result.failed.map(f => f.error)).toEqual(['conflicting changes to labels.persona', 'conflicting changes to labels.persona'])
    const r0 = await write([set('A', 'personas', ['pm']), set('A', 'status', 'pm')], { mappings: clash })
    expect(r0.result.failed).toEqual([])

    const merge: FieldMappings = { ...defaults, status: { from: { kind: 'issue', field: 'labels.status' } } }
    const r2 = await write([set('A', 'personas', ['pm']), set('A', 'status', 'Doing')], { mappings: merge })
    expect(r2.result.failed).toEqual([])
    expect(r2.api.updates[0]!.input).toEqual({ remove: { labels: ['persona:dev'] }, add: { labels: ['persona:pm', 'status:Doing'] } })
  })

  it('a dot entry conflicts with a direct set of its base field', async () => {
    const mappings: FieldMappings = {
      ...defaults,
      personas: { from: { kind: 'issue', field: 'labels' }, isArray: true },
      status: { from: { kind: 'issue', field: 'labels.status' } },
    }
    const { api, result } = await write([set('A', 'personas', ['x']), set('A', 'status', 'Doing')], { mappings })
    expect(result.failed.map(f => f.error)).toEqual(['conflicting changes to labels', 'conflicting changes to labels'])
    expect(api.updates).toEqual([])
  })

  it('merges blockers added and removed on one ticket', async () => {
    const { api, result } = await write([
      { type: 'link', nodeId: 'B', blockerId: 'A', add: true },
      { type: 'link', nodeId: 'B', blockerId: 'C', add: false },
    ])
    expect(result.failed).toEqual([])
    expect(api.updates).toEqual([{ ref: 'B', input: { add: { blockedBy: ['A'] }, remove: { blockedBy: ['C'] } } }])
  })

  it('registers a field for the default write mapping after one confirmation and returns the mapping', async () => {
    const { api, result, confirm } = await write([set('A', 'priority', 2)])
    expect(confirm).toHaveBeenCalledWith({ register: ['priority: number'], addMappings: ['priority ← issueField priority'] })
    expect(api.added).toEqual([{ name: 'priority', def: { kind: 'issueField', type: 'number', isArray: false } }])
    expect(api.updates[0]!.input).toEqual({ set: { priority: 2 } })
    expect(result.addMappings).toEqual({ priority: { from: { kind: 'issueField', field: 'priority' }, type: 'number' } })
  })

  it('returns a default write mapping only when a change through it was written', async () => {
    const s = project()
    const api = fakeApi(s)
    api.updateTicket = async () => { throw new Error('unparseable') }
    const result = await writeChanges(api, '/proj', defaults, s, [set('A', 'priority', 2)], yes)
    expect(result.failed.map(f => f.error)).toEqual(['unparseable'])
    expect(result.addMappings).toEqual({})
  })

  it('a declined confirmation fails the changes that need it, nothing else', async () => {
    const { api, result } = await write([set('A', 'priority', 2), set('A', 'title', 'x')], { confirm: false })
    expect(result.failed).toEqual([{ change: set('A', 'priority', 2), error: 'fissue field priority not registered (declined)' }])
    expect(api.added).toEqual([])
    expect(api.updates[0]!.input).toEqual({ set: { title: 'x' } })
    expect(result.addMappings).toEqual({})
  })

  it('registers a select mapping without values as text; never registers a system field', async () => {
    const mappings: FieldMappings = { ...defaults, status: { from: { kind: 'issueField', field: 'stage' }, type: 'select' } }
    const { api } = await write([set('A', 'status', 'Doing')], { mappings })
    expect(api.added[0]).toEqual({ name: 'stage', def: { kind: 'issueField', type: 'text', isArray: false } })

    const s = project()
    const { blockedBy: _, ...fields } = fissueConfig.fields
    s.config = { ...fissueConfig, fields }
    const { result, confirm } = await write([{ type: 'link', nodeId: 'B', blockerId: 'A', add: true }], { s })
    expect(result.failed[0]!.error).toBe('fissue field blockedBy is missing')
    expect(confirm).not.toHaveBeenCalled()
  })

  it('creates nested tickets in order, remapping temp ids', async () => {
    const { api, result } = await write([
      { type: 'create', nodeId: 'new:1', parentId: 'A', title: 'Child' },
      { type: 'create', nodeId: 'new:2', parentId: 'new:1', title: 'Grandchild' },
      { type: 'link', nodeId: 'new:2', blockerId: 'new:1', add: true },
    ])
    expect(result.failed).toEqual([])
    expect(api.creates).toEqual([{ title: 'Child', parent: 'A' }, { title: 'Grandchild', parent: 'P-100' }])
    expect(result.createdIds).toEqual({ 'new:1': 'P-100', 'new:2': 'P-101' })
    expect(api.updates).toEqual([{ ref: 'P-101', input: { add: { blockedBy: ['P-100'] } } }])
  })

  it('a failed create fails the changes that depend on it', async () => {
    const s = project()
    const api = fakeApi(s)
    api.createTicket = async () => { throw new Error('boom') }
    const result = await writeChanges(api, '/proj', defaults, s, [
      { type: 'create', nodeId: 'new:1', parentId: 'A', title: 'Child' },
      { type: 'create', nodeId: 'new:2', parentId: 'new:1', title: 'Grandchild' },
      set('new:1', 'status', 'Done'),
      set('A', 'title', 'ok'),
    ], yes)
    expect(result.failed.map(f => f.error)).toEqual(['boom', 'depends on failed create new:1', 'depends on failed create new:1'])
    expect(api.updates).toEqual([{ ref: 'A', input: { set: { title: 'ok' } } }])
  })

  it('a create that throws after writing counts as created', async () => {
    const s = project()
    const api = fakeApi(s)
    const create = api.createTicket.bind(api)
    api.createTicket = async (root, values) => { await create(root, values); throw new Error('sync failed') }
    const result = await writeChanges(api, '/proj', defaults, s, [
      { type: 'create', nodeId: 'new:1', parentId: 'A', title: 'Child' },
    ], yes)
    expect(result.failed).toEqual([])
    expect(result.createdIds).toEqual({ 'new:1': 'P-100' })
  })

  it('recovering a thrown create never claims a ticket another create made', async () => {
    const s = project()
    const api = fakeApi(s)
    const create = api.createTicket.bind(api)
    let n = 0
    api.createTicket = async (root, values) => {
      if (++n === 2) throw new Error('boom')
      return create(root, values)
    }
    const result = await writeChanges(api, '/proj', defaults, s, [
      { type: 'create', nodeId: 'new:1', parentId: 'A', title: 'Same' },
      { type: 'create', nodeId: 'new:2', parentId: 'A', title: 'Same' },
    ], yes)
    expect(result.failed.map(f => f.error)).toEqual(['boom'])
    expect(result.createdIds).toEqual({ 'new:1': 'P-100' })
  })

  it('a fissue error fails the ticket\'s changes; changed-on-disk is retried once', async () => {
    const s = project()
    const api = fakeApi(s)
    let n = 0
    api.updateTicket = async (_r, ref) => {
      n++
      if (ref === 'A' && n === 1) throw Object.assign(new Error('changed'), { code: 'changed-on-disk' })
      if (ref === 'B') throw new Error('unparseable')
      return { id: ref, changed: true }
    }
    const result = await writeChanges(api, '/proj', defaults, s, [set('A', 'title', 'a'), set('B', 'title', 'b')], yes)
    expect(result.failed).toEqual([{ change: set('B', 'title', 'b'), error: 'unparseable' }])
  })
})

describe('fissue checkChange', () => {
  const s = project()

  it('refuses values that cannot be written', () => {
    const priority: FieldMappings = { ...defaults, priority: { from: { kind: 'issueField', field: 'status' }, values: { Todo: 5, Done: 1 } } }
    expect(checkChange(priority, s, set('A', 'priority', 3))).toBe('no value in fieldMappings.priority.values reads as 3')
    expect(checkChange(priority, s, set('A', 'priority', 1))).toBeNull()
    expect(checkChange(defaults, s, set('A', 'status', 'Nope'))).toBe('fissue field status has no option "Nope"')
    const points: FieldMappings = { ...defaults, status: { from: { kind: 'issueField', field: 'points' } } }
    expect(checkChange(points, s, set('A', 'status', 'high'))).toMatch(/points \(number\) can't hold/)
    const v2: FieldMappings = { ...defaults, status: { from: { kind: 'projectV2', field: 'Status' } } }
    expect(checkChange(v2, s, set('A', 'status', 'Done'))).toMatch(/GitHub project field/)
    const body: FieldMappings = { ...defaults, status: { from: { kind: 'issue', field: 'body.status' } } }
    expect(checkChange(body, s, set('A', 'status', 'Done'))).toMatch(/not supported/)
    expect(checkChange(defaults, s, set('A', 'title', ' '))).toBe('a title is required')
    expect(checkChange(defaults, s, set('Z', 'title', 'x'))).toBe('ticket Z is not in fissue')
  })

  it('refuses a change that conflicts with another in the draft; the change it replaces is ignored', () => {
    const mappings: FieldMappings = {
      ...defaults,
      isDone: { from: { kind: 'issueField', field: 'status' }, values: { Todo: false, Done: true }, type: 'boolean' },
    }
    const draft = [set('A', 'status', 'Todo'), set('A', 'title', 'x')]
    expect(checkChange(mappings, s, set('A', 'isDone', true), draft)).toBe('conflicts with the status change on A (both write status)')
    expect(checkChange(mappings, s, set('A', 'isDone', false), draft)).toBeNull()
    expect(checkChange(mappings, s, set('A', 'status', 'Done'), draft)).toBeNull()
  })

  it('the default write mapping is refused by an existing field that does not fit it; a missing one is fine', () => {
    expect(checkChange(defaults, s, set('A', 'priority', 2))).toBeNull()
    const withSelect = state(s.tickets)
    withSelect.config = { ...fissueConfig, fields: { ...fissueConfig.fields, priority: { type: 'select', isArray: false, options: [{ name: 'P1' }] } } }
    expect(checkChange(defaults, withSelect, set('A', 'priority', 2))).toBe('fissue field priority has no option "2"')
  })

  it('is wired into FissueAdapter', async () => {
    const adapter = new FissueAdapter(fakeApi(project()), '/proj')
    const config: VertoConfig = { adapter: 'fissue', fissue: { root: '.', fieldMappings: defaults } }
    expect(await adapter.checkChange(config, set('A', 'status', 'Nope'))).toMatch(/no option/)
    const r = await adapter.writeBack(config, [set('A', 'status', 'Done')], yes)
    expect(r.failed).toEqual([])
  })
})
