import * as vscode from 'vscode'
import type { VertoConfig } from '@verto/config'
import { loadWorkspaceConfig, workspaceConfigPath } from './workspaceConfig.js'

export function getWorkspaceFolder(): string {
  const folders = vscode.workspace.workspaceFolders
  if (!folders || folders.length === 0) {
    throw new Error('Verto: No workspace folder is open.')
  }
  return folders[0].uri.fsPath
}

export function getWorkspaceConfigPath(): string {
  return workspaceConfigPath(getWorkspaceFolder())
}

export async function loadConfig(): Promise<{ config: VertoConfig; workspaceFolder: string }> {
  const workspaceFolder = getWorkspaceFolder()
  return { config: await loadWorkspaceConfig(workspaceFolder), workspaceFolder }
}
