import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as path from 'node:path'
import type { VertoConfig } from '@verto/config'
import { FissueAdapter } from '../adapter.js'
import { fakeApi, state, ticket } from './fixtures.js'

const config: VertoConfig = {
  adapter: 'fissue',
  fissue: { fieldMappings: { status: { from: { kind: 'issueField', field: 'status' }, type: 'select' } } },
}

describe('FissueAdapter', () => {
  beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}) })
  afterEach(() => { vi.restoreAllMocks() })

  it('rejects another API version', () => {
    const api = { ...fakeApi(state([])), apiVersion: 2 }
    expect(() => new FissueAdapter(api, '/ws')).toThrow(/version 2 is not supported.*expects 1/)
  })

  it('no project at/above the root → error naming the path', async () => {
    const adapter = new FissueAdapter(fakeApi(state([]), null), '/ws')
    await expect(adapter.loadProject({ adapter: 'fissue', fissue: { root: 'sub' } }))
      .rejects.toThrow(`No fissue project at/above ${path.resolve('/ws', 'sub')}; run \`fissue init\``)
  })

  it('resolves root against the workspace folder and walks up from it', async () => {
    const api = fakeApi(state([]))
    const find = vi.spyOn(api, 'findProjectRoot')
    await new FissueAdapter(api, '/ws').loadProject({ adapter: 'fissue' })
    expect(find).toHaveBeenCalledWith(path.resolve('/ws', '.'))
  })

  it('one projectState call per adapter, shared by concurrent calls', async () => {
    const api = fakeApi(state([ticket('P-1')]))
    const adapter = new FissueAdapter(api, '/ws')
    const [graph, , options] = await Promise.all([
      adapter.loadProject(config),
      adapter.checkFields(config),
      adapter.fetchStatusOptions(config),
    ])
    expect(api.calls).toBe(1)
    expect(graph.nodes.map(n => n.id)).toEqual(['P-1'])
    expect(options).toEqual(['Todo', 'In Progress', 'Done'])
  })

  it('status options are [] when status maps to a non-select field', async () => {
    const adapter = new FissueAdapter(fakeApi(state([])), '/ws')
    const c: VertoConfig = { adapter: 'fissue', fissue: { fieldMappings: { status: { from: { kind: 'issue', field: 'title' } } } } }
    await expect(adapter.fetchStatusOptions(c)).resolves.toEqual([])
  })

  it('a ticket without path/body → "too old" error', async () => {
    const t = { ...ticket('P-1'), body: undefined }
    await expect(new FissueAdapter(fakeApi(state([t])), '/ws').loadProject(config)).rejects.toThrow(/too old for Verto/)
  })

  it('title is "fissue: <root folder name>"', async () => {
    await expect(new FissueAdapter(fakeApi(state([])), '/ws').projectTitle({ adapter: 'fissue' })).resolves.toBe('fissue: proj')
  })

  it('checkFields scopes misses to the project config.json', async () => {
    const missing = await new FissueAdapter(fakeApi(state([])), '/ws').checkFields({
      adapter: 'fissue',
      fissue: { fieldMappings: { priority: { from: { kind: 'issueField', field: 'priority' } } } },
    })
    expect(missing).toEqual([{
      key: 'priority', field: 'priority', kind: 'issueField',
      scope: path.join('/proj', '.fissue', 'config.json'), reason: 'missing', suggestedKinds: [],
    }])
  })
})
