import type { VertoConfig, GitHubConfig } from '@verto/config'

export function requireGitHubConfig(config: VertoConfig): GitHubConfig {
  const github = config.github
  if (!github) {
    throw new Error('GitHub adapter requires a github configuration block')
  }
  return github
}
