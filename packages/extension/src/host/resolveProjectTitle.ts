import type { VertoConfig } from '@verto/config'
import { resolveProjectName } from '@verto/adapter-github'

/**
 * Adapter-aware panel title. GitHub resolves project/repo name; other adapters
 * fall back to the adapter id until they supply their own resolver.
 */
export async function resolveProjectTitle(
  config: VertoConfig,
  token: string,
): Promise<string> {
  switch (config.adapter) {
    case 'github': {
      if (!config.github) {
        throw new Error('Verto: github adapter requires a github configuration block')
      }
      return resolveProjectName(config, token)
    }
    default:
      return config.adapter
  }
}
