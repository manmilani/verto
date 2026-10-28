import { describe, it, expect } from 'vitest'
import type { VertoConfig } from '@verto/config'
import { changeLabel, DraftStore, projectKey, type StateStore } from '../host/draftStore.js'

function memento(init: Record<string, unknown> = {}): StateStore & { data: Record<string, unknown> } {
  const data = { ...init }
  return {
    data,
    get: <T>(k: string) => data[k] as T | undefined,
    async update(k, v) {
      if (v === undefined) delete data[k]
      else data[k] = v
    },
  }
}

describe('projectKey', () => {
  it('is the adapter block without fieldMappings, independent of key order', () => {
    const a = { adapter: 'fissue', fissue: { root: '.', fieldMappings: { x: { from: { kind: 'issue', field: 'x' } } } } } as VertoConfig
    const b = { adapter: 'fissue', fissue: { root: '.' } } as VertoConfig
    const c = { adapter: 'fissue', fissue: { root: 'sub' } } as VertoConfig
    expect(projectKey(a)).toBe(projectKey(b))
    expect(projectKey(a)).not.toBe(projectKey(c))
    const g1 = { adapter: 'github', github: { owner: 'o', repo: 'r' } } as unknown as VertoConfig
    const g2 = { adapter: 'github', github: { repo: 'r', owner: 'o' } } as unknown as VertoConfig
    expect(projectKey(g1)).toBe(projectKey(g2))
  })
})

describe('DraftStore', () => {
  it('keeps one draft per project with per-entry errors; drops malformed entries', async () => {
    const m = memento()
    const s = new DraftStore(m)
    await s.save('p1', [{ change: { type: 'set', nodeId: 'A', key: 'priority', value: 2 }, error: 'boom' }])
    await s.save('p2', [{ change: { type: 'link', nodeId: 'A', blockerId: 'B', add: true } }])
    expect(s.load('p1')).toEqual([{ change: { type: 'set', nodeId: 'A', key: 'priority', value: 2 }, error: 'boom' }])
    expect(s.load('p2')).toHaveLength(1)
    await s.save('p2', [])
    expect(Object.keys(m.data['verto.drafts'] as object)).toEqual(['p1'])
    m.data['verto.drafts'] = { p3: [{ change: { type: 'set', nodeId: 'A', key: 'nope', value: 1 } }] }
    expect(s.load('p3')).toEqual([])
  })

  it('migrates the old priority overlay once, for ids in the graph only', async () => {
    const m = memento({ 'verto.priorityOverlay': { A: 2, B: null, Z: 3 } })
    const s = new DraftStore(m)
    await s.save('p', [{ change: { type: 'set', nodeId: 'A', key: 'priority', value: 7 }, error: 'old' }])
    await s.migrateOverlay('p', new Set(['A', 'B']))
    expect(s.load('p')).toEqual([{ change: { type: 'set', nodeId: 'A', key: 'priority', value: 2 } }])
    expect(m.data['verto.priorityOverlay']).toBeUndefined()
    await s.migrateOverlay('q', new Set(['A']))
    expect(s.load('q')).toEqual([])
  })
})

describe('changeLabel', () => {
  it('describes each change type', () => {
    expect(changeLabel({ type: 'set', nodeId: 'P-1', key: 'priority', value: 2 })).toBe('P-1 priority → 2')
    expect(changeLabel({ type: 'set', nodeId: 'P-1', key: 'title', value: 'x' })).toBe('P-1 title → "x"')
    expect(changeLabel({ type: 'set', nodeId: 'P-1', key: 'personas', value: [] })).toBe('P-1 personas → (none)')
    expect(changeLabel({ type: 'set', nodeId: 'P-1', key: 'isDone', value: true })).toBe('P-1 done')
    expect(changeLabel({ type: 'link', nodeId: 'P-1', blockerId: 'P-2', add: false })).toBe('P-2 no longer blocks P-1')
    expect(changeLabel({ type: 'create', nodeId: 'new:1', parentId: 'P-1', title: 'C' })).toBe('new:1: new child of P-1, "C"')
  })
})
