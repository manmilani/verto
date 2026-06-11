import type { VertoNode, VertoGraph, VertoEdge } from '@verto/core'
import type { VertoConfig } from '@verto/config'
import type { GitHubIssue, GitHubProjectV2Item } from './system_types.js'
import { SystemFieldAccessor, ProjectFieldAccessor } from './project_fields.js'

export function mapIssuesToGraph(
  issues: GitHubIssue[],
  projectItemsByNodeId: Map<string, GitHubProjectV2Item>,
  config: VertoConfig,
): VertoGraph {
  const scope = config.github.scope
  const system = new SystemFieldAccessor()
  const project = new ProjectFieldAccessor(config.github.fieldMappings ?? {}, scope)

  const nodes: VertoNode[] = issues.map(issue => {
    const projectItem = projectItemsByNodeId.get(issue.id)
    const sysFields = system.toVertoNodeFields(issue)
    const projFields = project.toVertoNodeFields(issue, projectItem)
    return {
      ...sysFields,
      ...projFields,
      ticketFields: {
        ...sysFields.ticketFields,
        ...projFields.ticketFields,
      },
    } as VertoNode
  })

  const edgeKeys = new Set<string>()
  const edges: VertoEdge[] = []

  function addEdge(from: string, to: string, reason: 'blocking' | 'parent-child') {
    const key = `${from}:${to}:${reason}`
    if (!edgeKeys.has(key)) {
      edgeKeys.add(key)
      edges.push({ from, to, reason })
    }
  }

  for (const issue of issues) {
    for (const pred of issue.blockedBy.nodes) {
      addEdge(pred.id, issue.id, 'blocking')
    }
    for (const child of issue.subIssues.nodes) {
      addEdge(child.id, issue.id, 'parent-child')
    }
  }

  return { nodes, edges }
}
