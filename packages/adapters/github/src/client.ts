import { graphql } from '@octokit/graphql'
import type { GitHubIssue, GitHubProjectV2FieldValue, GitHubProjectV2Item } from './system_types.js'
import type { GitHubIssueFilter } from '@verto/config'

// Shared issue fields used in all queries
const ISSUE_FIELDS = `
  id
  number
  title
  body
  closed
  stateReason
  url
  createdAt
  updatedAt
  issueType { name }
  labels(first: 50) { nodes { name } }
  assignees(first: 20) { nodes { login } }
  milestone { title }
  parent { id }
  subIssues(first: 100) {
    nodes { id }
    pageInfo { hasNextPage endCursor }
  }
  blockedBy(first: 100) {
    nodes { id }
    pageInfo { hasNextPage endCursor }
  }
  blocking(first: 100) {
    nodes { id }
    pageInfo { hasNextPage endCursor }
  }
`

const FIELD_VALUE_FRAGMENTS = `
  ... on ProjectV2ItemFieldTextValue         { field { ... on ProjectV2FieldCommon { name } } text }
  ... on ProjectV2ItemFieldNumberValue       { field { ... on ProjectV2FieldCommon { name } } number }
  ... on ProjectV2ItemFieldDateValue         { field { ... on ProjectV2FieldCommon { name } } date }
  ... on ProjectV2ItemFieldSingleSelectValue { field { ... on ProjectV2FieldCommon { name } } name }
  ... on ProjectV2ItemFieldIterationValue    { field { ... on ProjectV2FieldCommon { name } } title }
`

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GQL = (query: string, variables?: Record<string, unknown>) => Promise<any>

export class GitHubClient {
  private readonly gql: GQL

  constructor(token: string) {
    this.gql = graphql.defaults({
      headers: { authorization: `token ${token}` },
    }) as GQL
  }

  async fetchProjectItems(
    owner: string,
    projectNumber: number,
    ownerType: 'user' | 'organization' = 'user',
  ): Promise<GitHubProjectV2Item[]> {
    const ownerField = ownerType === 'organization' ? 'organization' : 'user'
    const query = `
      query FetchProjectItems($owner: String!, $number: Int!, $after: String) {
        ${ownerField}(login: $owner) {
          projectV2(number: $number) {
            items(first: 100, after: $after) {
              pageInfo { hasNextPage endCursor }
              nodes {
                content { __typename ... on Issue { id } }
                fieldValues(first: 100) {
                  nodes { ${FIELD_VALUE_FRAGMENTS} }
                }
              }
            }
          }
        }
      }
    `

    const items: GitHubProjectV2Item[] = []
    let after: string | null = null

    do {
      const data = await this.request(query, { owner, number: projectNumber, after })
      const project = data[ownerField]?.projectV2
      if (!project) break

      const { nodes, pageInfo } = project.items
      for (const node of nodes) {
        if (node.content?.__typename !== 'Issue' || !node.content.id) continue
        items.push({
          issueNodeId: node.content.id,
          fieldValues: mapFieldValues(node.fieldValues?.nodes ?? []),
        })
      }
      after = pageInfo.hasNextPage ? pageInfo.endCursor : null
    } while (after)

    return items
  }

  async fetchIssuesByNodeIds(nodeIds: string[]): Promise<GitHubIssue[]> {
    const BATCH = 50
    const issues: GitHubIssue[] = []

    for (let i = 0; i < nodeIds.length; i += BATCH) {
      const batch = nodeIds.slice(i, i + BATCH)
      const query = `
        query FetchIssuesByIds($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on Issue { ${ISSUE_FIELDS} }
          }
        }
      `
      const data = await this.request(query, { ids: batch })
      const raw: GitHubIssue[] = (data.nodes ?? []).filter(
        (n: GitHubIssue | null) => n && 'id' in n,
      )
      issues.push(...raw)
    }

    // Follow nested pagination for any issue that has more than 100 items
    for (const issue of issues) {
      for (const connection of ['subIssues', 'blockedBy', 'blocking'] as const) {
        if (issue[connection].pageInfo.hasNextPage) {
          const extra = await this.fetchNestedConnection(issue.id, connection, issue[connection].pageInfo.endCursor!)
          issue[connection].nodes.push(...extra)
          issue[connection].pageInfo.hasNextPage = false
        }
      }
    }

    return issues
  }

  async fetchRepositoryIssues(
    owner: string,
    repo: string,
    filter?: GitHubIssueFilter,
  ): Promise<GitHubIssue[]> {
    const query = `
      query FetchRepoIssues($owner: String!, $name: String!, $states: [IssueState!], $labels: [String!], $assignee: String, $milestone: String, $after: String) {
        repository(owner: $owner, name: $name) {
          issues(
            first: 100
            after: $after
            states: $states
            filterBy: { labels: $labels, assignee: $assignee, milestone: $milestone }
          ) {
            pageInfo { hasNextPage endCursor }
            nodes { ${ISSUE_FIELDS} }
          }
        }
      }
    `

    const issues: GitHubIssue[] = []
    let after: string | null = null
    const states = filter?.states ?? ['OPEN']
    const labels = filter?.labels ?? null
    const assignee = filter?.assignee ?? null
    const milestone = filter?.milestone ?? null

    do {
      const data = await this.request(query, { owner, name: repo, states, labels, assignee, milestone, after })
      const connection = data.repository?.issues
      if (!connection) break

      issues.push(...connection.nodes.filter((n: GitHubIssue | null) => n?.id))
      after = connection.pageInfo.hasNextPage ? connection.pageInfo.endCursor : null
    } while (after)

    // Follow nested pagination
    for (const issue of issues) {
      for (const connection of ['subIssues', 'blockedBy', 'blocking'] as const) {
        if (issue[connection].pageInfo.hasNextPage) {
          const extra = await this.fetchNestedConnection(issue.id, connection, issue[connection].pageInfo.endCursor!)
          issue[connection].nodes.push(...extra)
          issue[connection].pageInfo.hasNextPage = false
        }
      }
    }

    return issues
  }

  private async fetchNestedConnection(
    issueId: string,
    connection: 'subIssues' | 'blockedBy' | 'blocking',
    startCursor: string,
  ): Promise<{ id: string }[]> {
    const query = `
      query FetchNestedPage($id: ID!, $after: String) {
        node(id: $id) {
          ... on Issue {
            ${connection}(first: 100, after: $after) {
              nodes { id }
              pageInfo { hasNextPage endCursor }
            }
          }
        }
      }
    `

    const nodes: { id: string }[] = []
    let after: string | null = startCursor

    do {
      const data = await this.request(query, { id: issueId, after })
      const conn = data.node?.[connection]
      if (!conn) break
      nodes.push(...conn.nodes)
      after = conn.pageInfo.hasNextPage ? conn.pageInfo.endCursor : null
    } while (after)

    return nodes
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async request(query: string, variables?: Record<string, unknown>): Promise<any> {
    const MAX_RETRIES = 3
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return await this.gql(query, variables)
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
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function mapFieldValues(nodes: Record<string, unknown>[]): GitHubProjectV2FieldValue[] {
  const result: GitHubProjectV2FieldValue[] = []
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue
    const fieldName = (node.field as { name: string } | null)?.name
    if (!fieldName) continue

    if ('text' in node && typeof node.text === 'string') {
      result.push({ fieldName, kind: 'text', value: node.text })
    } else if ('number' in node && typeof node.number === 'number') {
      result.push({ fieldName, kind: 'number', value: node.number })
    } else if ('date' in node && typeof node.date === 'string') {
      result.push({ fieldName, kind: 'date', value: node.date })
    } else if ('name' in node && typeof node.name === 'string' && node.name !== fieldName) {
      // ProjectV2ItemFieldSingleSelectValue: top-level `name` is the selected option name
      result.push({ fieldName, kind: 'single_select', value: node.name })
    } else if ('title' in node && typeof node.title === 'string') {
      result.push({ fieldName, kind: 'iteration', title: node.title })
    }
  }
  return result
}
