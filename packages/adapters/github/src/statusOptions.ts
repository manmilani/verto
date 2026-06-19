import type { VertoConfig } from '@verto/config'
import { requireGitHubConfig } from './githubConfig.js'
import { gqlRequest } from './gqlRequest.js'
import { statusOptionsFromProjectFields } from './projectField.js'

/** Status column option names from a GitHub ProjectV2 (empty when unavailable). */
export async function fetchProjectStatusOptions(
  token: string,
  config: VertoConfig,
): Promise<string[]> {
  const github = requireGitHubConfig(config)
  if (github.scope !== 'project') return []

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
    projectV2?: {
      fields: {
        nodes: Array<{ name?: string; options?: Array<{ name: string }> }>
      }
    }
  }>)[ownerField]?.projectV2
  if (!project) return []

  return statusOptionsFromProjectFields(project.fields.nodes, github.fieldMappings)
}
