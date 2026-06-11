import type { GitHubIssue } from './system_types.js'
import type { GitHubClient } from './client.js'

export async function expandGraphClosure(
  client: GitHubClient,
  initialIssues: GitHubIssue[],
  maxExpansions = 5,
): Promise<GitHubIssue[]> {
  const all = new Map(initialIssues.map(i => [i.id, i]))

  for (let round = 0; round < maxExpansions; round++) {
    const referenced = new Set<string>()
    for (const issue of all.values()) {
      issue.blockedBy.nodes.forEach(n => referenced.add(n.id))
      issue.blocking.nodes.forEach(n => referenced.add(n.id))
      issue.subIssues.nodes.forEach(n => referenced.add(n.id))
      // parent.id intentionally excluded: child's prereqIds does not include its parent
    }

    const missing = [...referenced].filter(id => !all.has(id))
    if (missing.length === 0) break

    const fetched = await client.fetchIssuesByNodeIds(missing)
    fetched.forEach(i => all.set(i.id, i))

    if (round === maxExpansions - 1) {
      const stillMissing = [...referenced].filter(id => !all.has(id))
      if (stillMissing.length > 0) {
        console.warn(
          `[verto] Graph closure incomplete after ${maxExpansions} rounds; ` +
            `${stillMissing.length} unresolved ref(s) will cause validation errors`,
        )
      }
      // Known limitation: issues fetched on this final round are not themselves scanned
      // for new refs. Any refs they introduce will surface as dangling_prereq from validateGraph.
    }
  }

  return [...all.values()]
}
