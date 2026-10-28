import type { UiConfig, VertoConfig } from './types.js'

function uiConfigHasValues(ui: UiConfig): boolean {
  return Object.values(ui).some(v => v !== undefined)
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

/** Merge ui config; undefined keys in workspace do not erase defaults. */
export function mergeUi(
  defaultsUi: UiConfig | undefined,
  workspaceUi: UiConfig | undefined,
): UiConfig | undefined {
  if (!defaultsUi && !workspaceUi) return undefined

  const merged: UiConfig = { ...defaultsUi }
  if (workspaceUi) {
    if (workspaceUi.displayStatusGroups !== undefined) {
      merged.displayStatusGroups = workspaceUi.displayStatusGroups
    }
  }

  return uiConfigHasValues(merged) ? merged : undefined
}

/**
 * Workspace wins over defaults (DESIGN.md §4.6.3). The adapter block (the one named by the
 * effective `adapter`) is merged per key, and its `fieldMappings` per entry.
 */
export function mergeConfigs(defaults: VertoConfig, workspace: Partial<VertoConfig>): VertoConfig {
  const { ui: workspaceUi, ...workspaceRest } = workspace
  const ui = mergeUi(defaults.ui, workspaceUi)

  const merged = {
    ...defaults,
    ...workspaceRest,
  } as VertoConfig & Record<string, unknown>

  const name = merged.adapter
  const d = (defaults as unknown as Record<string, unknown>)[name]
  const w = (workspace as Record<string, unknown>)[name]
  if (isPlainObject(d) || isPlainObject(w)) {
    const db = isPlainObject(d) ? d : {}
    const wb = isPlainObject(w) ? w : {}
    merged[name] = {
      ...db,
      ...wb,
      fieldMappings: {
        ...(db.fieldMappings as object | undefined),
        ...(wb.fieldMappings as object | undefined),
      },
    }
  }

  if (ui !== undefined) {
    merged.ui = ui
  } else {
    delete merged.ui
  }

  return merged
}
