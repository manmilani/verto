import type { MissingField, VertoAdapter, VertoGraph } from '@verto/core'
import { validateVertoConfig } from '@verto/config'
import type { VertoConfig } from '@verto/config'
import { GitHubClient } from './client.js'
import { expandGraphClosure, expandParentClosure } from './closure.js'
import { requireGitHubConfig } from './githubConfig.js'
import { mapIssuesToGraph } from './mapper.js'
import type { GitHubProjectV2Item } from './system_types.js'
import { fetchProjectStatusOptions } from './statusOptions.js'
import { resolveProjectName } from './projectName.js'

/** The field check (DESIGN.md §4.6.4) as far as built: org issue fields aren't read yet. */
export function checkGitHubFields(config: VertoConfig): MissingField[] {
  const github = requireGitHubConfig(config)
  return Object.entries(github.fieldMappings ?? {})
    .filter(([, entry]) => entry.from.kind === 'issueField')
    .map(([key, entry]) => ({
      key,
      field: entry.from.field,
      kind: entry.from.kind,
      scope: github.scope === 'project' ? `${github.owner}/project ${github.projectNumber}` : `${github.owner}/${github.repository}`,
      reason: 'unsupported' as const,
      suggestedKinds: [],
    }))
}

export class GitHubAdapter implements VertoAdapter<VertoConfig> {
  constructor(private readonly token: string) {}

  async fetchStatusOptions(config: VertoConfig): Promise<string[]> {
    return fetchProjectStatusOptions(this.token, config)
  }

  fieldMappings(config: VertoConfig): Record<string, unknown> | undefined {
    const github = requireGitHubConfig(config)
    return github.fieldMappings as Record<string, unknown> | undefined
  }

  async checkFields(config: VertoConfig): Promise<MissingField[]> {
    return checkGitHubFields(config)
  }

  async projectTitle(config: VertoConfig): Promise<string> {
    return resolveProjectName(config, this.token)
  }

  async loadProject(config: VertoConfig): Promise<VertoGraph> {
    validateVertoConfig(config)
    const client = new GitHubClient(this.token)

    let projectItemsByNodeId = new Map<string, GitHubProjectV2Item>()

    const github = requireGitHubConfig(config)

    let issues
    if (github.scope === 'project') {
      const items = await client.fetchProjectItems(
        github.owner,
        github.projectNumber,
        github.ownerType,
      )
      projectItemsByNodeId = new Map(items.map(item => [item.issueNodeId, item]))
      const boardIssues = await client.fetchIssuesByNodeIds([...projectItemsByNodeId.keys()])
      issues = await expandGraphClosure(client, boardIssues)
    } else {
      const filtered = await client.fetchRepositoryIssues(
        github.owner,
        github.repository,
        github.issueFilter,
      )
      issues = await expandGraphClosure(client, filtered)
      if (github.includeClosedAncestors !== false) {
        issues = await expandParentClosure(client, issues)
      }
    }

    return mapIssuesToGraph(issues, projectItemsByNodeId, config)
  }
}
