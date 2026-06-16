import type { VertoAdapter } from '@verto/core'
import type { VertoConfig } from '@verto/config'
import { GitHubAdapter } from '@verto/adapter-github'

export function getAdapter(config: VertoConfig, token: string): VertoAdapter<VertoConfig> {
  switch (config.adapter) {
    case 'github':
      return new GitHubAdapter(token)
    default:
      throw new Error(`Verto: Unknown adapter "${config.adapter}"`)
  }
}
