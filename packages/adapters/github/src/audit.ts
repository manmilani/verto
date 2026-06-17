import { graphql } from '@octokit/graphql'
import type { VertoConfig, FieldMappings, DisplayStatusGroup } from '@verto/config'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GQL = (query: string, variables?: Record<string, unknown>) => Promise<any>

function makeGql(token: string): GQL {
  return graphql.defaults({
    headers: { authorization: `token ${token}` },
  }) as GQL
}

export interface AuditResult {
  /** Partial config object suitable for passing to mergeConfigs() */
  discovered: Partial<VertoConfig>
  /** Non-fatal informational messages collected during audit */
  warnings: string[]
}

/**
 * Audits a GitHub ProjectV2 and returns a discovered config fragment with
 * fieldMappings and displayStatusGroups seeded from the project's fields.
 */
export async function auditProjectScope(token: string, config: VertoConfig): Promise<AuditResult> {
  if (config.github.scope !== 'project') {
    throw new Error('auditProjectScope requires config.github.scope === "project"')
  }

  const gql = makeGql(token)
  const warnings: string[] = []
  const ownerField = config.github.ownerType === 'organization' ? 'organization' : 'user'

  const data = await gql(
    `query($owner: String!, $number: Int!) {
      ${ownerField}(login: $owner) {
        projectV2(number: $number) {
          fields(first: 100) {
            nodes {
              __typename
              ... on ProjectV2FieldCommon { name dataType }
              ... on ProjectV2SingleSelectField { options { name } }
            }
          }
        }
      }
    }`,
    { owner: config.github.owner, number: config.github.projectNumber },
  )

  const project = data[ownerField]?.projectV2
  if (!project) {
    throw new Error('Project not found. Check owner, projectNumber, and ownerType.')
  }

  const fieldMappings: FieldMappings = {}
  let statusOptions: string[] = []

  for (const field of project.fields.nodes) {
    if (!field.name || field.name === 'Title') continue
    const entry: FieldMappings[string] = { from: { kind: 'projectV2', field: field.name } }
    if (field.dataType === 'SINGLE_SELECT') entry.type = 'select'
    if (field.dataType === 'NUMBER') entry.type = 'number'
    if (field.dataType === 'DATE') entry.type = 'date'
    if (field.dataType === 'ITERATION') entry.type = 'iteration'
    fieldMappings[field.name.toLowerCase().replace(/\s+/g, '_')] = entry
    if (field.name === 'Status' && Array.isArray(field.options)) {
      statusOptions = field.options.map((o: { name: string }) => o.name)
    }
  }

  if (!fieldMappings.priority) {
    warnings.push('No Priority field found — nodes will default to priority 5')
  }

  const displayStatusGroups: DisplayStatusGroup[] = [
    { label: 'Done', sources: { ticket: { isDone: true }, parsed: { isDone: true } } },
    ...statusOptions.map(name => ({
      label: name,
      sources: { ticket: { isDone: false, statuses: [name] } },
    })),
    { label: 'Raw', sources: { parsed: { isDone: false, statuses: ['raw'] } } },
  ]

  const discovered: Partial<VertoConfig> = {
    adapter: 'github',
    ui: { displayStatusGroups },
    github: {
      scope: 'project',
      owner: config.github.owner,
      projectNumber: config.github.projectNumber,
      ...(config.github.ownerType ? { ownerType: config.github.ownerType } : {}),
      fieldMappings,
    },
  }

  return { discovered, warnings }
}

/**
 * Audits a GitHub repository and returns a discovered config fragment.
 * Also logs informational messages about available labels and fieldMappings gaps.
 */
export async function auditRepositoryScope(token: string, config: VertoConfig): Promise<AuditResult> {
  if (config.github.scope !== 'repository') {
    throw new Error('auditRepositoryScope requires config.github.scope === "repository"')
  }

  const gql = makeGql(token)
  const warnings: string[] = []
  const repoConfig = config.github as Extract<VertoConfig['github'], { scope: 'repository' }>

  const data = await gql(
    `query($owner: String!, $name: String!) {
      repository(owner: $owner, name: $name) {
        labels(first: 100) {
          nodes { name }
        }
      }
    }`,
    { owner: config.github.owner, name: repoConfig.repository },
  )

  const repo = data.repository
  if (!repo) {
    throw new Error('Repository not found. Check owner and repository names.')
  }

  const labels: string[] = repo.labels.nodes.map((l: { name: string }) => l.name)
  if (labels.length > 0) {
    warnings.push(`Available labels (${labels.length}): ${labels.join(', ')}`)
    warnings.push('Add labels to github.issueFilter.labels to filter issues by label.')
  }
  warnings.push('Issue type: readable per-issue via fieldMappings type → { from: { kind: "issue", field: "type" } }')

  const configMappings = config.github.fieldMappings ?? {}
  const projectV2Gaps = Object.entries(configMappings)
    .filter(([, e]) => e.from.kind === 'projectV2')
    .map(([k]) => k)
  if (projectV2Gaps.length > 0) {
    warnings.push(`Excluded ${projectV2Gaps.length} projectV2 fieldMapping(s) not applicable in repository scope: ${projectV2Gaps.join(', ')}`)
  }

  const fieldMappings: FieldMappings = Object.fromEntries(
    Object.entries(configMappings).filter(([, e]) => e.from.kind === 'issue'),
  )

  const discovered: Partial<VertoConfig> = {
    adapter: 'github',
    github: {
      scope: 'repository',
      owner: config.github.owner,
      repository: repoConfig.repository,
      ...(repoConfig.issueFilter ? { issueFilter: repoConfig.issueFilter } : {}),
      fieldMappings,
    },
  }

  return { discovered, warnings }
}
