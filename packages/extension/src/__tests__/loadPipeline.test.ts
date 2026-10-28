import { describe, it, expect, afterEach, vi } from 'vitest'
import type { VertoConfig } from '@verto/config'
import type { VertoAdapter } from '@verto/core'
import { ADAPTERS, type AdapterEnv } from '../host/adapterRegistry.js'
import { runPipeline, formatSkippedFields } from '../host/loadPipeline.js'

const node = {
  id: 'A', title: 'A', isDone: false, isDeliverySlice: true, priority: 5, prereqIds: [], childIds: [],
  ticketUrl: 'file:///a.md', nodeType: 'ticket' as const, nodeOrigin: 'fake', personas: [], _rawReqIds: [],
}

const env: AdapterEnv = {
  workspaceFolder: '/ws',
  getGitHubToken: () => Promise.reject(new Error('not needed')),
  getFissueApi: () => Promise.reject(new Error('not needed')),
}

describe('runPipeline', () => {
  afterEach(() => { delete ADAPTERS['fake'] })

  it('skips mappings the field check reports, for every later step; title falls back to the adapter id', async () => {
    const seen: unknown[] = []
    const adapter: VertoAdapter<VertoConfig> = {
      async checkFields() {
        return [{ key: 'gone', field: 'g', kind: 'issueField', scope: 's', reason: 'missing', suggestedKinds: [] }]
      },
      fieldMappings: c => (c as unknown as { fake: { fieldMappings: Record<string, unknown> } }).fake.fieldMappings,
      async loadProject(c) {
        seen.push(c)
        return { nodes: [node], edges: [] }
      },
    }
    ADAPTERS['fake'] = { defaults: { adapter: 'fake' }, create: async () => adapter }
    const config = {
      adapter: 'fake',
      fake: { fieldMappings: { gone: { from: { kind: 'issueField', field: 'g' } }, kept: { from: { kind: 'issue', field: 'k' } } } },
    } as unknown as VertoConfig

    const out = await runPipeline(config, env, true)
    expect(out.projectName).toBe('fake')
    expect(out.skipped.map(m => m.key)).toEqual(['gone'])
    expect(Object.keys((seen[0] as { fake: { fieldMappings: object } }).fake.fieldMappings)).toEqual(['kept'])
    expect(out.bundle.graph.nodes.map(n => n.id)).toEqual(['A'])
  })

  it('creates the adapter through the registry env (GitHub token fetched only when needed)', async () => {
    const getFissueApi = vi.fn(() => Promise.reject(new Error('no fissue')))
    await expect(runPipeline({ adapter: 'fissue' }, { ...env, getFissueApi }, true)).rejects.toThrow('no fissue')
    expect(getFissueApi).toHaveBeenCalledOnce()
  })
})

describe('formatSkippedFields', () => {
  it('names each mapping and why', () => {
    expect(formatSkippedFields([
      { key: 'priority', field: 'priority', kind: 'issueField', scope: '/p/.fissue/config.json', reason: 'missing', suggestedKinds: [] },
      { key: 'board', field: 'Status', kind: 'projectV2', scope: '/p', reason: 'unsupported', suggestedKinds: [] },
    ])).toBe('Verto: skipped field mappings: priority (issueField "priority" not found in /p/.fissue/config.json); board (projectV2 "Status" not supported)')
  })
})
