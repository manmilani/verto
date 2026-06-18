import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolveOwner, listRepositories, listProjects, getViewerLogin } from '../discovery.js'
import * as graphqlModule from '@octokit/graphql'

vi.mock('@octokit/graphql', () => ({
  graphql: {
    defaults: vi.fn(),
  },
}))

describe('discovery', () => {
  let gqlFn: ReturnType<typeof vi.fn>

  beforeEach(() => {
    gqlFn = vi.fn()
    vi.mocked(graphqlModule.graphql.defaults).mockReturnValue(gqlFn as never)
  })

  it('getViewerLogin returns viewer login', async () => {
    gqlFn.mockResolvedValue({ viewer: { login: 'alice' } })
    await expect(getViewerLogin('token')).resolves.toBe('alice')
  })

  it('resolveOwner tries user then organization', async () => {
    gqlFn
      .mockResolvedValueOnce({ user: null })
      .mockResolvedValueOnce({ organization: { login: 'acme' } })
    await expect(resolveOwner('token', 'acme')).resolves.toEqual({
      owner: 'acme',
      ownerType: 'organization',
    })
  })

  it('resolveOwner throws when not found', async () => {
    gqlFn.mockResolvedValueOnce({ user: null }).mockResolvedValueOnce({ organization: null })
    await expect(resolveOwner('token', 'missing')).rejects.toThrow(/not found/)
  })

  it('listRepositories paginates and returns names', async () => {
    gqlFn
      .mockResolvedValueOnce({
        user: {
          repositories: {
            pageInfo: { hasNextPage: true, endCursor: 'c1' },
            nodes: [{ name: 'a' }],
          },
        },
      })
      .mockResolvedValueOnce({
        user: {
          repositories: {
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes: [{ name: 'b' }],
          },
        },
      })

    await expect(listRepositories('token', 'alice', 'user')).resolves.toEqual([
      { name: 'a' },
      { name: 'b' },
    ])
  })

  it('listProjects throws on API failure', async () => {
    gqlFn.mockResolvedValue({ user: {} })
    await expect(listProjects('token', 'alice', 'user')).rejects.toThrow(/Failed to list projects/)
  })
})
