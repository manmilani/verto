import { describe, it, expect, vi } from 'vitest'
import { expandGraphClosure } from '../closure.js'
import type { GitHubIssue } from '../system_types.js'
import type { GitHubClient } from '../client.js'

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

function mockClient(fetchMap: Record<string, GitHubIssue>): GitHubClient {
  return {
    fetchIssuesByNodeIds: vi.fn(async (ids: string[]) =>
      ids.map(id => fetchMap[id]).filter(Boolean),
    ),
  } as unknown as GitHubClient
}

describe('expandGraphClosure', () => {
  it('fetches transitive blockers across rounds', async () => {
    // A → blockedBy B → B blockedBy C (both external)
    const B = makeIssue('B', { blockedBy: { nodes: [{ id: 'C' }], pageInfo: { hasNextPage: false, endCursor: null } } })
    const C = makeIssue('C')
    const A = makeIssue('A', { blockedBy: { nodes: [{ id: 'B' }], pageInfo: { hasNextPage: false, endCursor: null } } })
    const client = mockClient({ B, C })
    const result = await expandGraphClosure(client, [A])
    expect(result.map(i => i.id).sort()).toEqual(['A', 'B', 'C'])
    expect(client.fetchIssuesByNodeIds).toHaveBeenCalledTimes(2)
  })

  it('fetches external dependents via blocking', async () => {
    // A has blocking=[D] (D not on board); D.blockedBy=[A]
    const D = makeIssue('D', { blockedBy: { nodes: [{ id: 'A' }], pageInfo: { hasNextPage: false, endCursor: null } } })
    const A = makeIssue('A', { blocking: { nodes: [{ id: 'D' }], pageInfo: { hasNextPage: false, endCursor: null } } })
    const client = mockClient({ D })
    const result = await expandGraphClosure(client, [A])
    expect(result.map(i => i.id).sort()).toEqual(['A', 'D'])
  })

  it('does NOT fetch parent (parent.id excluded from referenced set)', async () => {
    const P = makeIssue('P')
    const C = makeIssue('C', { parent: { id: 'P' } })
    const fetchSpy = vi.fn(async () => [])
    const client = { fetchIssuesByNodeIds: fetchSpy } as unknown as GitHubClient
    // P is not in initial set; C.parent = P but parent is not followed
    const result = await expandGraphClosure(client, [C])
    expect(result.map(i => i.id)).toEqual(['C'])
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('fetches sub-issues outside the initial set', async () => {
    const C = makeIssue('C')
    const P = makeIssue('P', { subIssues: { nodes: [{ id: 'C' }], pageInfo: { hasNextPage: false, endCursor: null } } })
    const client = mockClient({ C })
    const result = await expandGraphClosure(client, [P])
    expect(result.map(i => i.id).sort()).toEqual(['C', 'P'])
  })

  it('returns early when graph is already complete', async () => {
    const A = makeIssue('A')
    const fetchSpy = vi.fn(async () => [])
    const client = { fetchIssuesByNodeIds: fetchSpy } as unknown as GitHubClient
    await expandGraphClosure(client, [A])
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('emits a warning when a referenced issue cannot be fetched on the final round', async () => {
    // A.blockedBy=[B], but B is unfetchable (not found in any round)
    const A = makeIssue('A', {
      blockedBy: { nodes: [{ id: 'B' }], pageInfo: { hasNextPage: false, endCursor: null } },
    })
    // fetchIssuesByNodeIds returns [] — simulates B being inaccessible
    const client: GitHubClient = {
      fetchIssuesByNodeIds: vi.fn().mockResolvedValue([]),
    } as unknown as GitHubClient
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = await expandGraphClosure(client, [A], 1)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('incomplete after 1 rounds'))
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('A')
    warnSpy.mockRestore()
  })
})
