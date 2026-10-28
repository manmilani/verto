import { describe, it, expect, vi } from 'vitest'
import { GitHubClient } from '../client.js'
import { buildIssueSelection } from '../issue_selection.js'

type GqlSpy = ReturnType<typeof vi.fn>

function patchGql(client: GitHubClient, spy: GqlSpy) {
  ;(client as unknown as { gql: GqlSpy }).gql = spy
}

function emptyRepoResponse() {
  return {
    repository: {
      issues: {
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: [],
      },
    },
  }
}

describe('GitHubClient.fetchRepositoryIssues', () => {
  it('passes assignee and milestone filters to the GraphQL query variables', async () => {
    const client = new GitHubClient('test-token')
    const spy = vi.fn().mockResolvedValue(emptyRepoResponse())
    patchGql(client, spy)

    await client.fetchRepositoryIssues('owner', 'repo', {
      assignee: 'alice',
      milestone: 'v1.0',
      states: ['OPEN'],
    })

    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('$assignee: String'),
      expect.objectContaining({ assignee: 'alice', milestone: 'v1.0' }),
    )
  })

  it('passes null for assignee and milestone when filter omits them', async () => {
    const client = new GitHubClient('test-token')
    const spy = vi.fn().mockResolvedValue(emptyRepoResponse())
    patchGql(client, spy)

    await client.fetchRepositoryIssues('owner', 'repo', { labels: ['bug'] })

    expect(spy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ assignee: null, milestone: null }),
    )
  })
})

describe('GitHubClient issue selection', () => {
  const page = (ids: string[], hasNextPage = false, endCursor: string | null = null) => ({
    nodes: ids.map(id => ({ id })),
    pageInfo: { hasNextPage, endCursor },
  })
  const issue = (extra: Record<string, unknown>) => ({
    id: 'I1', title: 't', closed: false, url: 'u', createdAt: 'c', parent: null, labels: { nodes: [] },
    subIssues: page([]), blockedBy: page([]), blocking: page([]), ...extra,
  })

  it('both fetch paths send the constructor selection', async () => {
    const client = new GitHubClient('t', buildIssueSelection({ l: { from: { kind: 'issue', field: 'locked' } } }))
    const spy = vi.fn()
      .mockResolvedValueOnce({ nodes: [] })
      .mockResolvedValueOnce(emptyRepoResponse())
    patchGql(client, spy)
    await client.fetchIssuesByNodeIds(['I1'])
    await client.fetchRepositoryIssues('o', 'r')
    for (const [query] of spy.mock.calls) expect(query).toMatch(/\blocked\b/)
  })

  it('follows relatesTo past its first page when it is selected', async () => {
    const client = new GitHubClient('t', buildIssueSelection({ r: { from: { kind: 'issue', field: 'relatesTo' } } }))
    const spy = vi.fn()
      .mockResolvedValueOnce({ nodes: [issue({ relatesTo: page(['R1'], true, 'c1') })] })
      .mockResolvedValueOnce({ node: { relatesTo: page(['R2']) } })
    patchGql(client, spy)
    const [got] = await client.fetchIssuesByNodeIds(['I1'])
    expect(got.relatesTo?.nodes.map(n => n.id)).toEqual(['R1', 'R2'])
    expect(spy.mock.calls[1][0]).toContain('relatesTo(first: 100, after: $after)')
  })
})
