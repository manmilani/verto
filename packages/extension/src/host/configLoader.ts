import * as vscode from 'vscode'
import * as path from 'node:path'
import { mergeConfigs, readVertoConfigFile } from '@verto/config'
import { githubAdapterDefaults } from '@verto/adapter-github'

export async function loadConfig() {
  const folders = vscode.workspace.workspaceFolders
  if (!folders || folders.length === 0) {
    throw new Error('Verto: No workspace folder is open.')
  }
  const configPath = path.join(folders[0].uri.fsPath, '.vscode', 'verto.config.jsonc')
  let workspaceConfig
  try {
    workspaceConfig = await readVertoConfigFile(configPath)
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    throw new Error(`Verto: Failed to load .vscode/verto.config.jsonc — ${detail}`)
  }
  return mergeConfigs(githubAdapterDefaults, workspaceConfig)
}
