import type { VertoConfig } from '@verto/config'
import { requireGitHubConfig } from './githubConfig.js'
import { gqlRequest } from './gqlRequest.js'
import { statusOptionsFromProjectFields, type ProjectFieldNode } from './projectField.js'

/** Field definitions of the configured ProjectV2; `undefined` when not project scope or not found. */
export async function fetchProjectFieldNodes(
  token: string,
  config: VertoConfig,
): Promise<ProjectFieldNode[] | undefined> {
  const github = requireGitHubConfig(config)
  if (github.scope !== 'project') return undefined

  const ownerField = github.ownerType === 'organization' ? 'organization' : 'user'
  const data = await gqlRequest(
    token,
    `query($owner: String!, $number: Int!) {
      ${ownerField}(login: $owner) {
        projectV2(number: $number) {
          fields(first: 100) {
            nodes {
              __typename
              ... on ProjectV2FieldCommon { name }
              ... on ProjectV2SingleSelectField { options { name } }
            }
          }
        }
      }
    }`,
    { owner: github.owner, number: github.projectNumber },
  )

  const project = (data as Record<string, {
    projectV2?: { fields: { nodes: ProjectFieldNode[] } }
  }>)[ownerField]?.projectV2
  return project?.fields.nodes
}

/** Status column option names from a GitHub ProjectV2 (empty when unavailable). */
export async function fetchProjectStatusOptions(
  token: string,
  config: VertoConfig,
): Promise<string[]> {
  const fields = await fetchProjectFieldNodes(token, config)
  if (!fields) return []
  return statusOptionsFromProjectFields(fields, requireGitHubConfig(config).fieldMappings)
}
