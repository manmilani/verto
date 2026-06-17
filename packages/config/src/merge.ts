import type { UiConfig, VertoConfig } from './types.js'

function uiConfigHasValues(ui: UiConfig): boolean {
  return Object.values(ui).some(v => v !== undefined)
}

/** Merge ui config; undefined keys in workspace do not erase defaults. */
export function mergeUi(
  defaultsUi: UiConfig | undefined,
  workspaceUi: UiConfig | undefined,
): UiConfig | undefined {
  if (!defaultsUi && !workspaceUi) return undefined

  const merged: UiConfig = { ...defaultsUi }
  if (workspaceUi) {
    for (const key of Object.keys(workspaceUi) as (keyof UiConfig)[]) {
      const value = workspaceUi[key]
      if (value !== undefined) {
        merged[key] = value
      }
    }
  }

  return uiConfigHasValues(merged) ? merged : undefined
}

export function mergeConfigs(defaults: VertoConfig, workspace: Partial<VertoConfig>): VertoConfig {
  const { ui: workspaceUi, github: workspaceGithub, ...workspaceRest } = workspace
  const ui = mergeUi(defaults.ui, workspaceUi)

  const merged: VertoConfig = {
    ...defaults,
    ...workspaceRest,
    github: {
      ...defaults.github,
      ...workspaceGithub,
      fieldMappings: {
        ...defaults.github?.fieldMappings,
        ...workspaceGithub?.fieldMappings,
      },
    },
  }

  if (ui !== undefined) {
    merged.ui = ui
  } else {
    delete merged.ui
  }

  return merged
}
