import { describe, it, expect, vi } from 'vitest'
import { GitHubClient } from '../client.js'

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
