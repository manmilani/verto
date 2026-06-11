import type { VertoAdapter, DeliveryMapBundle } from '@verto/core'
import { validateGraph, buildDeliveryMapBundle } from '@verto/core'
import { validateVertoConfig } from '@verto/config'
import type { VertoConfig } from '@verto/config'
import { GitHubClient } from './client.js'
import { expandGraphClosure } from './closure.js'
import { mapIssuesToGraph } from './mapper.js'
import type { GitHubProjectV2Item } from './system_types.js'

export class GitHubAdapter implements VertoAdapter<VertoConfig> {
  constructor(private readonly token: string) {}

  async loadProject(config: VertoConfig): Promise<DeliveryMapBundle> {
    validateVertoConfig(config)
    const client = new GitHubClient(this.token)

    let projectItemsByNodeId = new Map<string, GitHubProjectV2Item>()

    let issues
    if (config.github.scope === 'project') {
      const items = await client.fetchProjectItems(
        config.github.owner,
        config.github.projectNumber,
        config.github.ownerType,
      )
      projectItemsByNodeId = new Map(items.map(item => [item.issueNodeId, item]))
      const boardIssues = await client.fetchIssuesByNodeIds([...projectItemsByNodeId.keys()])
      issues = await expandGraphClosure(client, boardIssues)
    } else {
      const filtered = await client.fetchRepositoryIssues(
        config.github.owner,
        config.github.repository,
        config.github.issueFilter,
      )
      issues = await expandGraphClosure(client, filtered)
    }

    const graph = mapIssuesToGraph(issues, projectItemsByNodeId, config)
    const result = validateGraph(graph)
    if (!result.valid) {
      throw new Error(
        `Graph validation failed:\n${result.errors.map(e => e.message).join('\n')}`,
      )
    }
    result.warnings.forEach(w => console.warn('[verto]', w.message))

    return buildDeliveryMapBundle(graph)
  }
}
