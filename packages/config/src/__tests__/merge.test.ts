import { describe, it, expect } from 'vitest'
import { mergeConfigs } from '../merge.js'
import type { VertoConfig, PortfolioColumn } from '../types.js'

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
  portfolioColumns: [
    { label: 'Done', sources: { ticket: { isDone: true } } },
    { label: 'Raw', sources: { parsed: { isDone: false, statuses: ['raw'] } } },
  ],
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

  it('workspace portfolioColumns fully replaces defaults array (no append)', () => {
    const workspaceCols: PortfolioColumn[] = [
      { label: 'Done', sources: { ticket: { isDone: true }, parsed: { isDone: true } } },
      { label: 'In Progress', sources: { ticket: { isDone: false, statuses: ['In Progress'] } } },
    ]
    const workspace: Partial<VertoConfig> = { portfolioColumns: workspaceCols }
    const merged = mergeConfigs(base, workspace)
    expect(merged.portfolioColumns).toHaveLength(2)
    expect(merged.portfolioColumns).toEqual(workspaceCols)
    expect(merged.portfolioColumns!.some(c => c.label === 'Raw')).toBe(false)
  })

  it('no workspace portfolioColumns → defaults portfolioColumns preserved', () => {
    const workspace: Partial<VertoConfig> = {
      github: { scope: 'project', owner: 'owner', projectNumber: 2 },
    }
    const merged = mergeConfigs(base, workspace)
    expect(merged.portfolioColumns).toEqual(base.portfolioColumns)
  })
})
