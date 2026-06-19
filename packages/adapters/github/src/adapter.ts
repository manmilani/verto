import type { VertoAdapter, VertoGraph } from '@verto/core'
import { validateVertoConfig } from '@verto/config'
import type { VertoConfig } from '@verto/config'
import { GitHubClient } from './client.js'
import { expandGraphClosure, expandParentClosure } from './closure.js'
import { requireGitHubConfig } from './githubConfig.js'
import { mapIssuesToGraph } from './mapper.js'
import type { GitHubProjectV2Item } from './system_types.js'
import { fetchProjectStatusOptions } from './statusOptions.js'

export class GitHubAdapter implements VertoAdapter<VertoConfig> {
  constructor(private readonly token: string) {}

  async fetchStatusOptions(config: VertoConfig): Promise<string[]> {
    return fetchProjectStatusOptions(this.token, config)
  }

  fieldMappings(config: VertoConfig): Record<string, unknown> | undefined {
    const github = requireGitHubConfig(config)
    return github.fieldMappings as Record<string, unknown> | undefined
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
