import * as vscode from 'vscode'
import { PanelManager } from './host/panelManager.js'

export function activate(context: vscode.ExtensionContext) {
  const manager = new PanelManager(context)
  context.subscriptions.push(
    vscode.commands.registerCommand('verto.openPanel', () => manager.openOrReveal()),
    vscode.commands.registerCommand('verto.refresh',   () => manager.refresh()),
  )
}

export function deactivate() {}
