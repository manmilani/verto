import type { VertoConfig } from './types.js'

export function mergeConfigs(defaults: VertoConfig, workspace: Partial<VertoConfig>): VertoConfig {
  return {
    ...defaults,
    ...workspace,
    github: {
      ...defaults.github,
      ...workspace.github,
      fieldMappings: {
        ...defaults.github?.fieldMappings,
        ...workspace.github?.fieldMappings,
      },
    },
  }
}
