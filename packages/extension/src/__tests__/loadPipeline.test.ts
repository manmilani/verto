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

    const out = (await runPipeline(config, env, true))!
    expect(out.projectName).toBe('fake')
    expect(out.skipped.map(m => m.key)).toEqual(['gone'])
    expect(Object.keys((seen[0] as { fake: { fieldMappings: object } }).fake.fieldMappings)).toEqual(['kept'])
    expect(out.bundle.graph.nodes.map(n => n.id)).toEqual(['A'])
  })

  it('confirmSkip decides: false cancels before loading (null); true skips and loads', async () => {
    const loadProject = vi.fn(async () => ({ nodes: [node], edges: [] }))
    const missing = [{ key: 'gone', field: 'g', kind: 'issue', scope: 's', reason: 'missing' as const, suggestedKinds: [] }]
    ADAPTERS['fake'] = {
      defaults: { adapter: 'fake' },
      create: async () => ({ checkFields: async () => missing, loadProject }),
    }
    const config = { adapter: 'fake' } as VertoConfig

    const confirm = vi.fn(async () => false)
    expect(await runPipeline(config, env, true, confirm)).toBeNull()
    expect(confirm).toHaveBeenCalledWith(missing)
    expect(loadProject).not.toHaveBeenCalled()

    expect((await runPipeline(config, env, true, async () => true))?.skipped).toEqual(missing)
    expect(loadProject).toHaveBeenCalledOnce()
  })

  it('confirmSkip is not asked when nothing is missing', async () => {
    ADAPTERS['fake'] = {
      defaults: { adapter: 'fake' },
      create: async () => ({ checkFields: async () => [], loadProject: async () => ({ nodes: [node], edges: [] }) }),
    }
    const confirm = vi.fn(async () => false)
    expect(await runPipeline({ adapter: 'fake' } as VertoConfig, env, true, confirm)).not.toBeNull()
    expect(confirm).not.toHaveBeenCalled()
  })

  it('creates the adapter through the registry env (GitHub token fetched only when needed)', async () => {
    const getFissueApi = vi.fn(() => Promise.reject(new Error('no fissue')))
    await expect(runPipeline({ adapter: 'fissue' }, { ...env, getFissueApi }, true)).rejects.toThrow('no fissue')
    expect(getFissueApi).toHaveBeenCalledOnce()
  })
})

describe('formatSkippedFields', () => {
  it('names each mapping, why, and other kinds where the name exists', () => {
    expect(formatSkippedFields([
      { key: 'priority', field: 'Priority', kind: 'issue', scope: 'GitHub Issue properties', reason: 'missing', suggestedKinds: ['issueField', 'projectV2'] },
      { key: 'board', field: 'Status', kind: 'projectV2', scope: '/p', reason: 'unsupported', suggestedKinds: [] },
    ])).toBe(
      'Verto: skipped field mappings: '
      + 'priority: kind "issue" "Priority" not found in GitHub Issue properties — found as kind "issueField", "projectV2"; '
      + 'board: kind "projectV2" "Status" not supported',
    )
  })
})
