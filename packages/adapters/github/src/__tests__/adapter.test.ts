import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GitHubAdapter } from '../adapter.js'
import type { VertoConfig } from '@verto/config'
import type { GitHubIssue, GitHubProjectV2Item } from '../system_types.js'

function makeIssue(id: string, overrides: Partial<GitHubIssue> = {}): GitHubIssue {
  return {
    id,
    number: 1,
    title: id,
    body: null,
    closed: false,
    stateReason: null,
    url: `https://github.com/issues/${id}`,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    issueType: null,
    labels: { nodes: [] },
    assignees: { nodes: [] },
    milestone: null,
    parent: null,
    subIssues: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
    blockedBy: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
    blocking: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
    ...overrides,
  }
}

const projectConfig: VertoConfig = {
  adapter: 'github',
  github: { scope: 'project', owner: 'test', projectNumber: 1 },
}

const repoConfig: VertoConfig = {
  adapter: 'github',
  github: { scope: 'repository', owner: 'test', repository: 'my-repo' },
}

describe('GitHubAdapter', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>
  beforeEach(() => { warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {}) })
  afterEach(() => { vi.restoreAllMocks() })

  it('project scope: fetches items + issues + closure → returns valid bundle', async () => {
    const issue = makeIssue('I1')
    const item: GitHubProjectV2Item = { issueNodeId: 'I1', fieldValues: [] }

    const adapter = new GitHubAdapter('test-token')
    const { GitHubClient } = await import('../client.js')
    const clientMock = {
      fetchProjectItems: vi.fn().mockResolvedValue([item]),
      fetchIssuesByNodeIds: vi.fn().mockResolvedValue([issue]),
      fetchRepositoryIssues: vi.fn().mockResolvedValue([]),
    }
    vi.spyOn(GitHubClient.prototype, 'fetchProjectItems').mockImplementation(clientMock.fetchProjectItems)
    vi.spyOn(GitHubClient.prototype, 'fetchIssuesByNodeIds').mockImplementation(clientMock.fetchIssuesByNodeIds)

    const bundle = await adapter.loadProject(projectConfig)
    expect(bundle.graph.nodes).toHaveLength(1)
    expect(bundle.graph.nodes[0].id).toBe('I1')
    expect(bundle.implementationOrder).toBeDefined()
  })

  it('external blocker auto-fetched via blockedBy → no dangling_prereq errors', async () => {
    const A = makeIssue('A', {
      blockedBy: { nodes: [{ id: 'B' }], pageInfo: { hasNextPage: false, endCursor: null } },
    })
    const B = makeIssue('B')
    const item: GitHubProjectV2Item = { issueNodeId: 'A', fieldValues: [] }

    const { GitHubClient } = await import('../client.js')
    vi.spyOn(GitHubClient.prototype, 'fetchProjectItems').mockResolvedValue([item])
    vi.spyOn(GitHubClient.prototype, 'fetchIssuesByNodeIds')
      .mockResolvedValueOnce([A])  // initial board fetch
      .mockResolvedValueOnce([B])  // closure expansion

    const adapter = new GitHubAdapter('test-token')
    const bundle = await adapter.loadProject(projectConfig)
    expect(bundle.graph.nodes.map(n => n.id).sort()).toEqual(['A', 'B'])
  })

  it('repository scope: fetches filtered issues + closure → valid bundle', async () => {
    const issue = makeIssue('R1')
    const { GitHubClient } = await import('../client.js')
    vi.spyOn(GitHubClient.prototype, 'fetchRepositoryIssues').mockResolvedValue([issue])
    vi.spyOn(GitHubClient.prototype, 'fetchIssuesByNodeIds').mockResolvedValue([])

    const adapter = new GitHubAdapter('test-token')
    const bundle = await adapter.loadProject(repoConfig)
    expect(bundle.graph.nodes).toHaveLength(1)
    expect(bundle.graph.nodes[0].id).toBe('R1')
  })

  it('throws before network call when config is invalid', async () => {
    const bad = { adapter: 'github', github: { scope: 'project', owner: 'x' } } as unknown as VertoConfig
    const adapter = new GitHubAdapter('test-token')
    const { GitHubClient } = await import('../client.js')
    const fetchSpy = vi.spyOn(GitHubClient.prototype, 'fetchProjectItems')
    await expect(adapter.loadProject(bad)).rejects.toThrow(/projectNumber/)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('external dependent via blocking.nodes auto-fetched → appears in graph', async () => {
    const A = makeIssue('A', {
      blocking: { nodes: [{ id: 'D' }], pageInfo: { hasNextPage: false, endCursor: null } },
    })
    const D = makeIssue('D', {
      blockedBy: { nodes: [{ id: 'A' }], pageInfo: { hasNextPage: false, endCursor: null } },
    })
    const item: GitHubProjectV2Item = { issueNodeId: 'A', fieldValues: [] }

    const { GitHubClient } = await import('../client.js')
    vi.spyOn(GitHubClient.prototype, 'fetchProjectItems').mockResolvedValue([item])
    vi.spyOn(GitHubClient.prototype, 'fetchIssuesByNodeIds')
      .mockResolvedValueOnce([A])  // initial board fetch
      .mockResolvedValueOnce([D])  // closure: A.blocking=[D]

    const adapter = new GitHubAdapter('test-token')
    const bundle = await adapter.loadProject(projectConfig)
    expect(bundle.graph.nodes.map(n => n.id).sort()).toEqual(['A', 'D'])
    expect(bundle.graph.edges).toContainEqual({ from: 'A', to: 'D', reason: 'blocking' })
  })

  it('loadProject throws when validateGraph errors (dangling prereq from failed closure)', async () => {
    const A = makeIssue('A', {
      blockedBy: { nodes: [{ id: 'B' }], pageInfo: { hasNextPage: false, endCursor: null } },
    })
    const item: GitHubProjectV2Item = { issueNodeId: 'A', fieldValues: [] }

    const { GitHubClient } = await import('../client.js')
    vi.spyOn(GitHubClient.prototype, 'fetchProjectItems').mockResolvedValue([item])
    vi.spyOn(GitHubClient.prototype, 'fetchIssuesByNodeIds')
      .mockResolvedValueOnce([A])  // initial board fetch
      .mockResolvedValue([])       // all closure rounds: B not found (inaccessible)

    const adapter = new GitHubAdapter('test-token')
    await expect(adapter.loadProject(projectConfig)).rejects.toThrow(/Graph validation failed/)
  })

  it('all nodes at priority 5 when no priority fieldMapping → valid (not an error)', async () => {
    const issue = makeIssue('I1')
    const item: GitHubProjectV2Item = { issueNodeId: 'I1', fieldValues: [] }
    const { GitHubClient } = await import('../client.js')
    vi.spyOn(GitHubClient.prototype, 'fetchProjectItems').mockResolvedValue([item])
    vi.spyOn(GitHubClient.prototype, 'fetchIssuesByNodeIds').mockResolvedValue([issue])

    const adapter = new GitHubAdapter('test-token')
    const bundle = await adapter.loadProject(projectConfig)
    expect(bundle.graph.nodes[0].priority).toBe(5)
  })
})
