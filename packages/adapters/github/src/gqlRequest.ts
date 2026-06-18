import { graphql } from '@octokit/graphql'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GQL = (query: string, variables?: Record<string, unknown>) => Promise<any>

function makeGql(token: string): GQL {
  return graphql.defaults({
    headers: { authorization: `token ${token}` },
  }) as GQL
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function gqlRequest(
  token: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<unknown> {
  const gql = makeGql(token)
  const MAX_RETRIES = 3
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await gql(query, variables)
    } catch (err: unknown) {
      const httpErr = err as { status?: number; response?: { status?: number } }
      const status = httpErr.status ?? httpErr.response?.status
      if ((status === 403 || status === 429) && attempt < MAX_RETRIES - 1) {
        await sleep(100 * Math.pow(2, attempt))
        continue
      }
      throw err
    }
  }
  throw new Error('Unreachable')
}
