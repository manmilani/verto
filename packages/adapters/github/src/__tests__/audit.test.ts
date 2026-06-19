import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { VertoConfig } from '@verto/config'
import { auditProjectScope, auditRepositoryScope, buildWizardConfigComments } from '../audit.js'
import * as graphqlModule from '@octokit/graphql'

vi.mock('@octokit/graphql', () => ({
  graphql: {
    defaults: vi.fn(),
  },
}))

describe('audit enrichment', () => {
  let gqlFn: ReturnType<typeof vi.fn>

  beforeEach(() => {
    gqlFn = vi.fn()
    vi.mocked(graphqlModule.graphql.defaults).mockReturnValue(gqlFn as never)
  })

  it('auditProjectScope merges issue-native defaults with discovered fields', async () => {
    gqlFn.mockResolvedValue({
      user: {
        projectV2: {
          fields: {
            nodes: [
              {
                name: 'Status',
                dataType: 'SINGLE_SELECT',
                options: [{ name: 'Draft' }, { name: 'Doing' }, { name: 'Closed' }],
              },
              { name: 'Priority', dataType: 'SINGLE_SELECT', options: [] },
            ],
          },
        },
      },
    })

    const config: VertoConfig = {
      adapter: 'github',
      github: { scope: 'project', owner: 'acme', projectNumber: 1 },
    }
    const { discovered } = await auditProjectScope('token', config)
    expect(discovered.github?.fieldMappings?.type).toBeDefined()
    expect(discovered.github?.fieldMappings?.status).toBeDefined()
    expect(discovered.github?.fieldMappings?.priority).toBeDefined()
    expect(discovered.ui?.displayStatusGroups?.map(g => g.label)).toEqual(['In Progress', 'Raw'])
    const inProgress = discovered.ui?.displayStatusGroups?.find(g => g.label === 'In Progress')
    expect(inProgress?.sources.ticket?.statuses).toEqual(['Doing'])
  })

  it('auditProjectScope seeds displayStatusGroups from configured status field name', async () => {
    gqlFn.mockResolvedValue({
      user: {
        projectV2: {
          fields: {
            nodes: [
              {
                name: 'Workflow Status',
                dataType: 'SINGLE_SELECT',
                options: [{ name: 'Draft' }, { name: 'Doing' }, { name: 'Closed' }],
              },
            ],
          },
        },
      },
    })

    const config: VertoConfig = {
      adapter: 'github',
      github: {
        scope: 'project',
        owner: 'acme',
        projectNumber: 1,
        fieldMappings: {
          status: { from: { kind: 'projectV2', field: 'Workflow Status' }, type: 'select' },
        },
      },
    }
    const { discovered } = await auditProjectScope('token', config)
    expect(discovered.ui?.displayStatusGroups?.map(g => g.label)).toEqual(['In Progress', 'Raw'])
    const inProgress = discovered.ui?.displayStatusGroups?.find(g => g.label === 'In Progress')
    expect(inProgress?.sources.ticket?.statuses).toEqual(['Doing'])
  })

  it('auditProjectScope seeds status from case-insensitive Status column match', async () => {
    gqlFn.mockResolvedValue({
      user: {
        projectV2: {
          fields: {
            nodes: [
              {
                name: 'status',
                dataType: 'SINGLE_SELECT',
                options: [{ name: 'Draft' }, { name: 'Doing' }, { name: 'Closed' }],
              },
            ],
          },
        },
      },
    })

    const config: VertoConfig = {
      adapter: 'github',
      github: { scope: 'project', owner: 'acme', projectNumber: 1 },
    }
    const { discovered } = await auditProjectScope('token', config)
    expect(discovered.github?.fieldMappings?.status?.from.field).toBe('status')
    expect(discovered.ui?.displayStatusGroups?.find(g => g.label === 'In Progress')?.sources.ticket?.statuses)
      .toEqual(['Doing'])
  })

  it('auditProjectScope seeds priority via case-insensitive Priority match', async () => {
    gqlFn.mockResolvedValue({
      user: {
        projectV2: {
          fields: {
            nodes: [
              {
                name: 'Status',
                dataType: 'SINGLE_SELECT',
                options: [{ name: 'Open' }, { name: 'Closed' }],
              },
              { name: 'priority', dataType: 'NUMBER' },
            ],
          },
        },
      },
    })

    const config: VertoConfig = {
      adapter: 'github',
      github: { scope: 'project', owner: 'acme', projectNumber: 1 },
    }
    const { discovered, warnings } = await auditProjectScope('token', config)
    expect(discovered.github?.fieldMappings?.priority?.from.field).toBe('priority')
    expect(discovered.github?.fieldMappings?.priority?.type).toBe('number')
    expect(warnings.some(w => w.includes('priority'))).toBe(false)
  })

  it('auditProjectScope warns when no priority mapping can be seeded', async () => {
    gqlFn.mockResolvedValue({
      user: {
        projectV2: {
          fields: {
            nodes: [
              {
                name: 'Status',
                dataType: 'SINGLE_SELECT',
                options: [{ name: 'Open' }],
              },
            ],
          },
        },
      },
    })

    const config: VertoConfig = {
      adapter: 'github',
      github: { scope: 'project', owner: 'acme', projectNumber: 1 },
    }
    const { warnings } = await auditProjectScope('token', config)
    expect(warnings.some(w => w.includes('No priority field mapping'))).toBe(true)
  })

  it('auditRepositoryScope seeds issueFilter when seedRepoDefaults is true', async () => {
    gqlFn.mockResolvedValue({
      repository: { labels: { nodes: [{ name: 'bug' }] } },
    })

    const config: VertoConfig = {
      adapter: 'github',
      github: { scope: 'repository', owner: 'acme', repository: 'app' },
    }
    const { discovered, warnings } = await auditRepositoryScope('token', config, { seedRepoDefaults: true })
    if (discovered.github?.scope === 'repository') {
      expect(discovered.github.issueFilter).toEqual({ states: ['OPEN'] })
      expect(discovered.github.includeClosedAncestors).toBe(true)
    }
    expect(discovered.github?.fieldMappings?.type).toBeDefined()
    expect(warnings.some(w => w.includes('labels'))).toBe(true)
  })

  it('auditRepositoryScope omits issueFilter when seedRepoDefaults is false', async () => {
    gqlFn.mockResolvedValue({
      repository: { labels: { nodes: [] } },
    })

    const config: VertoConfig = {
      adapter: 'github',
      github: { scope: 'repository', owner: 'acme', repository: 'app' },
    }
    const { discovered } = await auditRepositoryScope('token', config, { seedRepoDefaults: false })
    if (discovered.github?.scope === 'repository') {
      expect(discovered.github.issueFilter).toBeUndefined()
      expect(discovered.github.includeClosedAncestors).toBeUndefined()
    }
  })

  it('buildWizardConfigComments includes repository guidance', () => {
    const text = buildWizardConfigComments('repository')
    expect(text).toContain('includeClosedAncestors')
    expect(text).toContain('issueFilter')
  })

  it('mergeIssueNativeDefaults restores issue-native labels when audit discovers a projectV2 Labels column', async () => {
    // Audit discovers a "Labels" SINGLE_SELECT board column and would key it as
    // `labels: { kind: 'projectV2', field: 'Labels' }`.  mergeIssueNativeDefaults must
    // overwrite that with the more reliable issue-native resolver so that labels-based
    // sub-field extraction (e.g. labels.persona) works correctly.
    gqlFn.mockResolvedValue({
      user: {
        projectV2: {
          fields: {
            nodes: [
              { name: 'Status', dataType: 'SINGLE_SELECT', options: [{ name: 'Open' }] },
              { name: 'Labels', dataType: 'SINGLE_SELECT', options: [] },
            ],
          },
        },
      },
    })
    const config: VertoConfig = {
      adapter: 'github',
      github: { scope: 'project', owner: 'acme', projectNumber: 1 },
    }
    const { discovered } = await auditProjectScope('token', config)
    // Must be issue-native, not the projectV2 Labels column
    expect(discovered.github?.fieldMappings?.labels?.from.kind).toBe('issue')
    expect(discovered.github?.fieldMappings?.labels?.from.field).toBe('labels')
  })

  it('mergeIssueNativeDefaults leaves workspace-configured issue mapping untouched', async () => {
    // A user's explicit issue-native labels mapping should survive the merge unchanged.
    gqlFn.mockResolvedValue({
      user: {
        projectV2: {
          fields: {
            nodes: [
              { name: 'Status', dataType: 'SINGLE_SELECT', options: [{ name: 'Open' }] },
              { name: 'Labels', dataType: 'SINGLE_SELECT', options: [] },
            ],
          },
        },
      },
    })
    const config: VertoConfig = {
      adapter: 'github',
      github: {
        scope: 'project',
        owner: 'acme',
        projectNumber: 1,
        fieldMappings: {
          labels: { from: { kind: 'issue', field: 'labels' } },
        },
      },
    }
    const { discovered } = await auditProjectScope('token', config)
    // Workspace-configured issue mapping must not be overwritten
    expect(discovered.github?.fieldMappings?.labels?.from.kind).toBe('issue')
  })
})
