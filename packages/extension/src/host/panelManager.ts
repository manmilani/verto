import * as vscode from 'vscode'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { HostToWebviewMessage, PersistedPanelState, WebviewToHostMessage } from '../shared/protocol.js'
import { loadConfig } from './configLoader.js'
import { isSetupRequiredConfigError, shouldAutoStartSetupForConfigError } from './configErrors.js'
import { getGitHubToken } from './authProvider.js'
import { runPipeline } from './loadPipeline.js'
import { loadOverlay, saveOverlay } from './priorityOverlay.js'
import { runSetup } from './setupWizard.js'

const STATE_KEY_PARSED = 'verto.parsedEnabled'
const STATE_KEY_PANEL  = 'verto.panelState'
const WATCHER_DEBOUNCE_MS = 750

export class PanelManager {
  private panel: vscode.WebviewPanel | undefined
  private ready = false
  private fetchSeq = 0
  private overlay: Record<string, number | null> = {}
  private setupInProgress = false
  private shouldAutoStartSetup = false
  private watcherDebounce: ReturnType<typeof setTimeout> | undefined

  constructor(private readonly context: vscode.ExtensionContext) {
    this.overlay = loadOverlay(context)

    const watcher = vscode.workspace.createFileSystemWatcher('**/.vscode/verto.config.jsonc')
    const scheduleRefresh = () => {
      if (this.setupInProgress || !this.panel) return
      if (this.watcherDebounce) clearTimeout(this.watcherDebounce)
      this.watcherDebounce = setTimeout(() => {
        this.watcherDebounce = undefined
        if (this.setupInProgress || !this.panel) return
        void this.fetch()
      }, WATCHER_DEBOUNCE_MS)
    }
    watcher.onDidCreate(scheduleRefresh)
    watcher.onDidChange(scheduleRefresh)
    context.subscriptions.push(watcher)
  }

  openOrReveal() {
    if (this.panel) {
      this.panel.reveal()
      return
    }
    this.shouldAutoStartSetup = true
    this.panel = vscode.window.createWebviewPanel(
      'vertoPanel',
      'Verto',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview'),
        ],
      },
    )
    this.panel.webview.html = this.buildHtml()
    this.ready = false
    this.panel.webview.onDidReceiveMessage(
      (msg: WebviewToHostMessage) => this.handleMessage(msg),
      undefined,
      this.context.subscriptions,
    )
    this.panel.onDidDispose(
      () => {
        if (this.watcherDebounce) {
          clearTimeout(this.watcherDebounce)
          this.watcherDebounce = undefined
        }
        this.panel = undefined
        this.ready = false
      },
      undefined,
      this.context.subscriptions,
    )
  }

  async refresh() {
    if (!this.panel) {
      this.openOrReveal()
      return
    }
    await this.fetch()
  }

  async runSetupCommand() {
    await this.invokeSetup({ prefillFromWorkspace: true })
  }

  private async invokeSetup(options?: { prefillFromWorkspace?: boolean }) {
    if (this.setupInProgress) return
    this.setupInProgress = true
    this.send({ type: 'loading' })
    let shouldRefresh = false
    try {
      shouldRefresh = await runSetup(this.context, options)
    } finally {
      this.setupInProgress = false
    }
    if (shouldRefresh) {
      await this.fetch()
    }
  }

  private async handleMessage(msg: WebviewToHostMessage) {
    switch (msg.type) {
      case 'ready':
        if (this.ready) return
        this.ready = true
        await this.fetch()
        break
      case 'setParsedEnabled':
        await this.context.workspaceState.update(STATE_KEY_PARSED, msg.enabled)
        await this.fetch()
        break
      case 'persistState':
        await this.context.workspaceState.update(STATE_KEY_PANEL, msg.state)
        break
      case 'setPriority': {
        if (msg.priority === null) {
          delete this.overlay[msg.sliceId]
        } else {
          const clamped = Math.max(1, Math.min(9, Math.round(msg.priority)))
          this.overlay[msg.sliceId] = clamped
        }
        await saveOverlay(this.context, this.overlay)
        await this.fetch()
        break
      }
      case 'retry':
        await this.fetch()
        break
      case 'runSetup':
        await this.invokeSetup({ prefillFromWorkspace: true })
        break
    }
  }

  private async fetch() {
    if (this.setupInProgress) {
      this.send({ type: 'loading' })
      return
    }

    const seq = ++this.fetchSeq
    this.send({ type: 'loading' })

    let config
    try {
      config = await loadConfig()
    } catch (err) {
      if (seq !== this.fetchSeq) return
      const msg = err instanceof Error ? err.message : String(err)
      if (isSetupRequiredConfigError(err)) {
        this.send({ type: 'error', message: msg, setupRequired: true })
        if (this.shouldAutoStartSetup && shouldAutoStartSetupForConfigError(err)) {
          this.shouldAutoStartSetup = false
          await this.invokeSetup()
        }
      } else {
        vscode.window.showErrorMessage(msg)
        this.send({ type: 'error', message: msg })
      }
      return
    }

    this.shouldAutoStartSetup = false

    if (seq !== this.fetchSeq) return

    const token = await getGitHubToken()
    if (!token) {
      if (seq !== this.fetchSeq) return
      const msg = 'Verto: GitHub authentication was cancelled.'
      vscode.window.showErrorMessage(msg)
      this.send({ type: 'error', message: msg })
      return
    }

    if (seq !== this.fetchSeq) return

    const parsedEnabled: boolean =
      this.context.workspaceState.get<boolean>(STATE_KEY_PARSED) ?? true

    try {
      const { bundle, displayStatusGroups, projectName, priorityOptionHints } = await runPipeline(config, token, parsedEnabled, this.overlay)
      if (seq !== this.fetchSeq) return
      for (const node of bundle.graph.nodes) {
        if (node.ticketFields) delete node.ticketFields['body']
      }
      const restoredState = this.context.workspaceState.get<PersistedPanelState>(STATE_KEY_PANEL)
      const priorityOverlayActive = Object.values(this.overlay).some(v => v !== null)
      const journeyPriorityOverlay = Object.fromEntries(
        Object.entries(this.overlay).filter((entry): entry is [string, number] => entry[1] !== null),
      )
      this.send({
        type: 'update',
        bundle,
        displayStatusGroups,
        parsedEnabled,
        priorityOverlayActive,
        projectName,
        journeyPriorityOverlay,
        priorityOptionHints,
        restoredState,
      })
    } catch (err) {
      if (seq !== this.fetchSeq) return
      const msg = err instanceof Error ? err.message : String(err)
      vscode.window.showErrorMessage(`Verto: ${msg}`)
      this.send({ type: 'error', message: msg })
    }
  }

  private send(msg: HostToWebviewMessage) {
    if (!this.panel || !this.ready) return
    this.panel.webview.postMessage(msg)
  }

  private buildHtml(): string {
    const webviewDistPath = vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview')
    const indexPath = path.join(webviewDistPath.fsPath, 'index.html')
    let html = fs.readFileSync(indexPath, 'utf8')

    html = html.replace(/(href|src)="(\.\/[^"]+)"/g, (_match: string, attr: string, assetPath: string) => {
      const assetUri = vscode.Uri.joinPath(webviewDistPath, assetPath.slice(2))
      return `${attr}="${this.panel!.webview.asWebviewUri(assetUri)}"`
    })

    const csp = [
      `default-src 'none'`,
      `script-src ${this.panel!.webview.cspSource}`,
      `style-src ${this.panel!.webview.cspSource} 'unsafe-inline'`,
      `font-src ${this.panel!.webview.cspSource}`,
      `img-src ${this.panel!.webview.cspSource} data:`,
    ].join('; ')

    html = html.replace(
      '</head>',
      `<meta http-equiv="Content-Security-Policy" content="${csp}">\n</head>`,
    )

    return html
  }
}
