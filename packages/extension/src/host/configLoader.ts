import * as vscode from 'vscode'
import * as path from 'node:path'
import {
  mergeConfigs,
  parseVertoConfig,
  readVertoConfigRawFile,
  isWorkspaceSetupComplete,
} from '@verto/config'
import { githubAdapterDefaults } from '@verto/adapter-github'
import {
  ConfigMissingError,
  ConfigIncompleteError,
  ConfigInvalidError,
} from './configErrors.js'

export function getWorkspaceConfigPath(): string {
  const folders = vscode.workspace.workspaceFolders
  if (!folders || folders.length === 0) {
    throw new Error('Verto: No workspace folder is open.')
  }
  return path.join(folders[0].uri.fsPath, '.vscode', 'verto.config.jsonc')
}

export async function loadConfig() {
  const configPath = getWorkspaceConfigPath()

  let raw: Record<string, unknown>
  try {
    raw = await readVertoConfigRawFile(configPath)
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT') {
      throw new ConfigMissingError()
    }
    const detail = err instanceof Error ? err.message : String(err)
    throw new ConfigInvalidError(`Verto: Failed to read .vscode/verto.config.jsonc — ${detail}`)
  }

  let workspaceConfig
  try {
    workspaceConfig = parseVertoConfig(JSON.stringify(raw))
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    throw new ConfigInvalidError(`Verto: Invalid .vscode/verto.config.jsonc — ${detail}`)
  }

  if (!isWorkspaceSetupComplete(raw)) {
    throw new ConfigIncompleteError()
  }

  return mergeConfigs(githubAdapterDefaults, workspaceConfig)
}
