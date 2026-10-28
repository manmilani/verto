import * as path from 'node:path'
import { mergeConfigs, parseVertoConfig, readVertoConfigRawFile, type VertoConfig } from '@verto/config'
import { findAdapter } from './adapterRegistry.js'
import { ConfigMissingError, ConfigIncompleteError, ConfigInvalidError } from './configErrors.js'

export function workspaceConfigPath(workspaceFolder: string): string {
  return path.join(workspaceFolder, '.vscode', 'verto.config.jsonc')
}

/**
 * Setup completeness, one rule (DESIGN.md §4.6.9): an adapter with a setup wizard decides;
 * any other known adapter is complete once its config validates.
 */
export function isRawConfigComplete(raw: Record<string, unknown>): boolean {
  const entry = findAdapter(raw.adapter)
  if (!entry) return false
  if (entry.setup) return entry.setup.isComplete(raw)
  try {
    parseVertoConfig(JSON.stringify(raw))
    return true
  } catch {
    return false
  }
}

/**
 * Read → validate → completeness → merge with the adapter's defaults. Setup is offered
 * (ConfigMissing/Incomplete/Invalid errors) when the adapter has a wizard or no adapter can be
 * read from the file; otherwise errors are plain, with a hint to edit the file.
 */
export async function loadWorkspaceConfig(workspaceFolder: string): Promise<VertoConfig> {
  const configPath = workspaceConfigPath(workspaceFolder)

  let raw: Record<string, unknown>
  try {
    raw = await readVertoConfigRawFile(configPath)
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT') throw new ConfigMissingError()
    const detail = err instanceof Error ? err.message : String(err)
    throw new ConfigInvalidError(`Verto: Failed to read .vscode/verto.config.jsonc — ${detail}`)
  }

  const entry = findAdapter(raw?.adapter)
  if (!entry) {
    const detail = typeof raw?.adapter === 'string' ? `unknown adapter "${raw.adapter}"` : 'no "adapter" given'
    throw new ConfigIncompleteError(`Verto: .vscode/verto.config.jsonc has ${detail} — run Setup.`)
  }

  let workspaceConfig: VertoConfig
  try {
    workspaceConfig = parseVertoConfig(JSON.stringify(raw))
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    const message = `Verto: Invalid .vscode/verto.config.jsonc — ${detail}`
    throw entry.setup ? new ConfigInvalidError(message) : new Error(`${message} (edit the file to fix it)`)
  }

  if (entry.setup && !entry.setup.isComplete(raw)) throw new ConfigIncompleteError()

  return mergeConfigs(entry.defaults, workspaceConfig)
}
