import { gqlRequest } from './gqlRequest.js'

export interface ResolvedOwner {
  owner: string
  ownerType: 'user' | 'organization'
}

export interface RepositorySummary {
  name: string
}

export interface ProjectSummary {
  number: number
  title: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function request(token: string, query: string, variables?: Record<string, unknown>): Promise<any> {
  return gqlRequest(token, query, variables)
}

export async function getViewerLogin(token: string): Promise<string> {
  const data = await request(token, `query { viewer { login } }`)
  const login = data.viewer?.login as string | undefined
  if (!login) {
    throw new Error('Could not determine authenticated GitHub user.')
  }
  return login
}

export async function resolveOwner(token: string, login: string): Promise<ResolvedOwner> {
  const userData = await request(
    token,
    `query($login: String!) { user(login: $login) { login } }`,
    { login },
  )
  if (userData.user?.login) {
    return { owner: login, ownerType: 'user' }
  }

  const orgData = await request(
    token,
    `query($login: String!) { organization(login: $login) { login } }`,
    { login },
  )
  if (orgData.organization?.login) {
    return { owner: login, ownerType: 'organization' }
  }

  throw new Error(`GitHub owner "${login}" not found as a user or organization.`)
}

export async function listRepositories(
  token: string,
  owner: string,
  ownerType: 'user' | 'organization',
): Promise<RepositorySummary[]> {
  const ownerField = ownerType === 'organization' ? 'organization' : 'user'
  const query = `
    query($owner: String!, $after: String) {
      ${ownerField}(login: $owner) {
        repositories(first: 100, after: $after, ownerAffiliations: [OWNER, ORGANIZATION_MEMBER, COLLABORATOR], orderBy: { field: PUSHED_AT, direction: DESC }) {
          pageInfo { hasNextPage endCursor }
          nodes { name }
        }
      }
    }
  `

  const repos: RepositorySummary[] = []
  let after: string | null = null

  do {
    const data = await request(token, query, { owner, after })
    const connection = data[ownerField]?.repositories
    if (!connection) {
      throw new Error(`Failed to list repositories for ${owner}.`)
    }
    for (const node of connection.nodes ?? []) {
      if (node?.name) repos.push({ name: node.name as string })
    }
    after = connection.pageInfo?.hasNextPage ? connection.pageInfo.endCursor : null
  } while (after)

  return repos
}

export async function listProjects(
  token: string,
  owner: string,
  ownerType: 'user' | 'organization',
): Promise<ProjectSummary[]> {
  const ownerField = ownerType === 'organization' ? 'organization' : 'user'
  const query = `
    query($owner: String!, $after: String) {
      ${ownerField}(login: $owner) {
        projectsV2(first: 100, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes { number title }
        }
      }
    }
  `

  const projects: ProjectSummary[] = []
  let after: string | null = null

  do {
    const data = await request(token, query, { owner, after })
    const connection = data[ownerField]?.projectsV2
    if (!connection) {
      throw new Error(`Failed to list projects for ${owner}.`)
    }
    for (const node of connection.nodes ?? []) {
      if (node?.number != null) {
        projects.push({ number: node.number as number, title: node.title as string })
      }
    }
    after = connection.pageInfo?.hasNextPage ? connection.pageInfo.endCursor : null
  } while (after)

  return projects
}
