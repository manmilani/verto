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
    expect(discovered.ui?.displayStatusGroups?.map(g => g.label)).toEqual(['Done', 'In Progress', 'Raw'])
    const inProgress = discovered.ui?.displayStatusGroups?.find(g => g.label === 'In Progress')
    expect(inProgress?.sources.ticket?.statuses).toEqual(['Doing'])
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
})
