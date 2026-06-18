import type { VertoConfig } from '@verto/config'
import { GitHubClient } from './client.js'
import { requireGitHubConfig } from './githubConfig.js'

/**
 * Human-readable project label for panel titles — GitHub project title or repository name.
 */
export async function resolveProjectName(
  config: VertoConfig,
  token: string,
): Promise<string> {
  const g = requireGitHubConfig(config)
  if (g.scope === 'repository') return g.repository

  const client = new GitHubClient(token)
  const title = await client.fetchProjectTitle(g.owner, g.projectNumber, g.ownerType)
  return title ?? `${g.owner} #${g.projectNumber}`
}
