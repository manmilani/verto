import * as vscode from 'vscode'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { HostToWebviewMessage, PersistedPanelState, WebviewToHostMessage } from '../shared/protocol.js'
import { loadConfig } from './configLoader.js'
import { getGitHubToken } from './authProvider.js'
import { runPipeline } from './loadPipeline.js'
import { loadOverlay, saveOverlay } from './priorityOverlay.js'

const STATE_KEY_PARSED = 'verto.parsedEnabled'
const STATE_KEY_PANEL  = 'verto.panelState'

export class PanelManager {
  private panel: vscode.WebviewPanel | undefined
  private ready = false
  private fetchSeq = 0
  private overlay: Record<string, number | null> = {}

  constructor(private readonly context: vscode.ExtensionContext) {
    this.overlay = loadOverlay(context)
  }

  openOrReveal() {
    if (this.panel) {
      this.panel.reveal()
      return
    }
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
      () => { this.panel = undefined; this.ready = false },
      undefined,
      this.context.subscriptions,
    )
    // 'loading' will be sent by fetch() once the webview signals 'ready'
  }

  async refresh() {
    if (!this.panel) {
      this.openOrReveal()
      return
    }
    await this.fetch()
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
    }
  }

  private async fetch() {
    const seq = ++this.fetchSeq
    this.send({ type: 'loading' })

    let config
    try {
      config = await loadConfig()
    } catch (err) {
      if (seq !== this.fetchSeq) return
      const msg = err instanceof Error ? err.message : String(err)
      vscode.window.showErrorMessage(msg)
      this.send({ type: 'error', message: msg })
      return
    }

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
      const { bundle, displayStatusGroups } = await runPipeline(config, token, parsedEnabled, this.overlay)
      if (seq !== this.fetchSeq) return
      for (const node of bundle.graph.nodes) {
        if (node.ticketFields) delete node.ticketFields['body']
      }
      const restoredState = this.context.workspaceState.get<PersistedPanelState>(STATE_KEY_PANEL)
      const priorityOverlayActive = Object.values(this.overlay).some(v => v !== null)
      this.send({
        type: 'update',
        bundle,
        displayStatusGroups,
        parsedEnabled,
        priorityOverlayActive,
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

    // Replace relative asset paths with webview URIs
    html = html.replace(/(href|src)="(\.\/[^"]+)"/g, (_match: string, attr: string, assetPath: string) => {
      const assetUri = vscode.Uri.joinPath(webviewDistPath, assetPath.slice(2))
      return `${attr}="${this.panel!.webview.asWebviewUri(assetUri)}"`
    })

    // Inject CSP before </head>
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
