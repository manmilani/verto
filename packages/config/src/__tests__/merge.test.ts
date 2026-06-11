import { describe, it, expect } from 'vitest'
import { mergeConfigs } from '../merge.js'
import type { VertoConfig } from '../types.js'

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
    expect(merged.github.fieldMappings!['status']).toEqual({
      from: { kind: 'projectV2', field: 'Status' },
      type: 'select',
    })
    expect((merged.github.fieldMappings!['status'] as { values?: unknown }).values).toBeUndefined()
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
    expect(merged.github.fieldMappings!['priority']).toBeDefined()
    expect(merged.github.fieldMappings!['type']).toBeDefined()
    expect(merged.github.fieldMappings!['status']).toEqual(base.github.fieldMappings!['status'])
  })

  it('no workspace fieldMappings → defaults fieldMappings unchanged', () => {
    const workspace: Partial<VertoConfig> = {
      github: { scope: 'project', owner: 'owner', projectNumber: 2 },
    }
    const merged = mergeConfigs(base, workspace)
    expect(merged.github.fieldMappings).toEqual(base.github.fieldMappings)
    expect(merged.github.scope).toBe('project')
    if (merged.github.scope === 'project') {
      expect(merged.github.projectNumber).toBe(2)
    }
  })
})
