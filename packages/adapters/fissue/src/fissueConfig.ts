import type { FissueConfig, VertoConfig } from '@verto/config'

/** The `fissue` block; every property is optional, so a missing block is an empty one. */
export function requireFissueConfig(config: VertoConfig): FissueConfig {
  if (config.adapter !== 'fissue') {
    throw new Error(`Verto: fissue adapter given a config for adapter "${config.adapter}"`)
  }
  return config.fissue ?? {}
}
