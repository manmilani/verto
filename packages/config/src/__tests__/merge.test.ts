import { describe, it, expect } from 'vitest'
import { mergeConfigs } from '../merge.js'
import type { VertoConfig, DisplayStatusGroup } from '../types.js'

const base: VertoConfig = {
  adapter: 'github',
  github: {
    scope: 'project',
    owner: 'owner',
    projectNumber: 1,
    fieldMappings: {
      status: { from: { kind: 'projectV2', field: 'Status' }, type: 'select', values: { Open: false, Done: true } },
      type: { from: { kind: 'issue', field: 'type' } },
    },
  },
  ui: {
    displayStatusGroups: [
      { label: 'Done', sources: { ticket: { isDone: true } } },
      { label: 'Raw', sources: { parsed: { isDone: false, statuses: ['raw'] } } },
    ],
  },
}

describe('mergeConfigs', () => {
  it('workspace fieldMappings entry fully replaces defaults entry (including values)', () => {
    const workspace: Partial<VertoConfig> = {
      github: {
        scope: 'project',
        owner: 'owner',
        projectNumber: 1,
        fieldMappings: {
          status: { from: { kind: 'projectV2', field: 'Status' }, type: 'select' },
        },
      },
    }
    const merged = mergeConfigs(base, workspace)
    expect(merged.github!.fieldMappings!['status']).toEqual({
      from: { kind: 'projectV2', field: 'Status' },
      type: 'select',
    })
    expect((merged.github!.fieldMappings!['status'] as { values?: unknown }).values).toBeUndefined()
  })

  it('new workspace key is added; defaults keys are preserved', () => {
    const workspace: Partial<VertoConfig> = {
      github: {
        scope: 'project',
        owner: 'owner',
        projectNumber: 1,
        fieldMappings: {
          priority: { from: { kind: 'projectV2', field: 'Priority' } },
        },
      },
    }
    const merged = mergeConfigs(base, workspace)
    expect(merged.github!.fieldMappings!['priority']).toBeDefined()
    expect(merged.github!.fieldMappings!['type']).toBeDefined()
    expect(merged.github!.fieldMappings!['status']).toEqual(base.github!.fieldMappings!['status'])
  })

  it('no workspace fieldMappings → defaults fieldMappings unchanged', () => {
    const workspace: Partial<VertoConfig> = {
      github: { scope: 'project', owner: 'owner', projectNumber: 2 },
    }
    const merged = mergeConfigs(base, workspace)
    const github = merged.github!
    expect(github.fieldMappings).toEqual(base.github!.fieldMappings)
    expect(github.scope).toBe('project')
    if (github.scope === 'project') {
      expect(github.projectNumber).toBe(2)
    }
  })

  it('workspace ui.displayStatusGroups fully replaces defaults array (no append)', () => {
    const workspaceGroups: DisplayStatusGroup[] = [
      { label: 'Done', sources: { ticket: { isDone: true }, parsed: { isDone: true } } },
      { label: 'In Progress', sources: { ticket: { isDone: false, statuses: ['In Progress'] } } },
    ]
    const workspace: Partial<VertoConfig> = {
      ui: { displayStatusGroups: workspaceGroups },
    }
    const merged = mergeConfigs(base, workspace)
    expect(merged.ui?.displayStatusGroups).toHaveLength(2)
    expect(merged.ui?.displayStatusGroups).toEqual(workspaceGroups)
    expect(merged.ui?.displayStatusGroups!.some(c => c.label === 'Raw')).toBe(false)
  })

  it('no workspace ui → defaults displayStatusGroups preserved', () => {
    const workspace: Partial<VertoConfig> = {
      github: { scope: 'project', owner: 'owner', projectNumber: 2 },
    }
    const merged = mergeConfigs(base, workspace)
    expect(merged.ui?.displayStatusGroups).toEqual(base.ui?.displayStatusGroups)
  })

  it('workspace ui: {} preserves defaults displayStatusGroups', () => {
    const workspace: Partial<VertoConfig> = { ui: {} }
    const merged = mergeConfigs(base, workspace)
    expect(merged.ui?.displayStatusGroups).toEqual(base.ui?.displayStatusGroups)
  })

  it('workspace ui.displayStatusGroups undefined does not erase defaults', () => {
    const workspace: Partial<VertoConfig> = { ui: { displayStatusGroups: undefined } }
    const merged = mergeConfigs(base, workspace)
    expect(merged.ui?.displayStatusGroups).toEqual(base.ui?.displayStatusGroups)
  })

  it('neither defaults nor workspace ui → merged.ui is undefined', () => {
    const noUi: VertoConfig = {
      adapter: 'github',
      github: base.github,
    }
    const merged = mergeConfigs(noUi, { github: { scope: 'project', owner: 'owner', projectNumber: 2 } })
    expect(merged.ui).toBeUndefined()
  })
})
