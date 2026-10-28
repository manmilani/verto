import * as vscode from 'vscode'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { VertoChange, WriteConfirmation } from '@verto/core'
import { discardChanges, parseChange, TEMP_ID_PREFIX } from '@verto/core'
import { insertFieldMappings } from '@verto/config'
import type { HostToWebviewMessage, PersistedPanelState, WebviewToHostMessage, WriteBackMode } from '../shared/protocol.js'
import { getWorkspaceConfigPath, loadConfig } from './configLoader.js'
import { isSetupRequiredConfigError, shouldAutoStartSetupForConfigError } from './configErrors.js'
import { getGitHubToken } from './authProvider.js'
import { describeMissingField, loadProjectGraph, type LoadedProject, type ProjectView } from './loadPipeline.js'
import type { AdapterEnv } from './adapterRegistry.js'
import { getFissueApi } from './fissueApi.js'
import { changeLabel, DraftStore, projectKey } from './draftStore.js'
import { acceptEdit, afterWrite, canWrite, invalidReason, viewWithDraft } from './draftSession.js'
import { runSetup } from './setupWizard.js'
import { SkipPrompt } from './skipPrompt.js'
import { ticketUri } from './ticketUri.js'

function hostEnv(workspaceFolder: string, warn: (message: string) => void): AdapterEnv {
  return {
    workspaceFolder,
    async getGitHubToken() {
      const token = await getGitHubToken()
      if (!token) throw new Error('Verto: GitHub authentication was cancelled.')
      return token
    },
    getFissueApi,
    warn,
  }
}

const SKIP_AND_LOAD = 'Skip and load'
const SET_UP_AND_WRITE = 'Set up and write'
const WRITING = 'Verto: a write is in progress; try again.'

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function writeBackMode(): WriteBackMode {
  return vscode.workspace.getConfiguration('verto').get<string>('writeBack.mode') === 'immediate' ? 'immediate' : 'draft'
}

const STATE_KEY_PARSED = 'verto.parsedEnabled'
const STATE_KEY_PANEL  = 'verto.panelState'
const WATCHER_DEBOUNCE_MS = 750

export class PanelManager {
  private panel: vscode.WebviewPanel | undefined
  private ready = false
  private fetchSeq = 0
  private readonly drafts: DraftStore
  /** The last load; edits rebuild the view from it without reloading the tracker. */
  private current: { loaded: LoadedProject; key: string } | undefined
  private lastView: ProjectView | undefined
  private writing = false
  /** Edits, discards and writes run one at a time. */
  private queue: Promise<void> = Promise.resolve()
  private writeQueued = false
  /** Write confirmations declined (by request) since the last Write back click. */
  private readonly declinedWrites = new Set<string>()
  private setupInProgress = false
  private shouldAutoStartSetup = false
  private watcherDebounce: ReturnType<typeof setTimeout> | undefined
  /** Field-check prompt; its "Skip and load" memory lasts for the extension session. */
  private readonly skipPrompt = new SkipPrompt(async detail =>
    (await vscode.window.showWarningMessage(
      "Verto: some field mappings can't be read.",
      { modal: true, detail },
      SKIP_AND_LOAD,
    )) === SKIP_AND_LOAD,
  )
  /** Adapter warnings already shown this session. */
  private readonly shownWarnings = new Set<string>()
  private readonly warnOnce = (message: string) => {
    if (this.shownWarnings.has(message)) return
    this.shownWarnings.add(message)
    void vscode.window.showWarningMessage(message)
  }

  constructor(private readonly context: vscode.ExtensionContext) {
    this.drafts = new DraftStore(context.workspaceState)
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('verto.writeBack.mode')) void this.render()
    }))

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
      case 'edit':
      case 'discard':
        if (this.writing) {
          await this.refuse(WRITING)
          break
        }
        await this.serial(() => (msg.type === 'edit' ? this.edit(msg.change) : this.discard(msg.changes)))
        break
      case 'writeBack':
        if (this.writing || this.writeQueued) break
        this.writeQueued = true
        this.declinedWrites.clear()
        await this.serial(async () => {
          this.writeQueued = false
          await this.writeBack()
        })
        break
      case 'retry':
        await this.fetch()
        break
      case 'runSetup':
        await this.invokeSetup({ prefillFromWorkspace: true })
        break
      case 'openTicket': {
        const uri = ticketUri(msg.url)
        if (uri) {
          await vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(uri))
        } else {
          console.warn(`[verto] not opening ticket URL ${msg.url}`)
        }
        break
      }
    }
  }

  private async fetch() {
    if (this.setupInProgress) {
      this.send({ type: 'loading' })
      return
    }

    const seq = ++this.fetchSeq
    this.send({ type: 'loading' })

    let loaded
    try {
      loaded = await loadConfig()
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

    try {
      const configKey = JSON.stringify(loaded.config)
      const project = await loadProjectGraph(
        loaded.config,
        hostEnv(loaded.workspaceFolder, this.warnOnce),
        missing => this.skipPrompt.confirm(
          configKey,
          missing.map(describeMissingField).join('\n'),
          () => seq === this.fetchSeq,
        ),
      )
      if (seq !== this.fetchSeq) return
      if (!project) {
        this.send({ type: 'error', message: 'Verto: load cancelled. Fix or remove the listed fieldMappings, then Retry.' })
        return
      }
      const key = projectKey(project.fullConfig)
      await this.drafts.migrateOverlay(key, new Set(project.graph.nodes.map(n => n.id)))
      this.current = { loaded: project, key }
    } catch (err) {
      if (seq !== this.fetchSeq) return
      this.showLoadError(err)
      return
    }
    await this.render()
  }

  private showLoadError(err: unknown) {
    const msg = messageOf(err)
    vscode.window.showErrorMessage(msg.startsWith('Verto:') ? msg : `Verto: ${msg}`)
    this.send({ type: 'error', message: msg })
  }

  private parsedEnabled(): boolean {
    return this.context.workspaceState.get<boolean>(STATE_KEY_PARSED) ?? true
  }

  /** Build the view from the last load with the draft applied, and send it. */
  private async render() {
    const cur = this.current
    if (!cur) return
    const parsedEnabled = this.parsedEnabled()
    let built
    try {
      built = viewWithDraft(cur.loaded, this.drafts.load(cur.key), parsedEnabled)
    } catch (err) {
      this.showLoadError(err)
      return
    }
    if (built.pruned) await this.drafts.save(cur.key, built.entries)
    if (this.current !== cur) return
    const { view, entries } = built
    this.lastView = view
    const { bundle } = view
    const nodes = bundle.graph.nodes.map(n => {
      if (!n.ticketFields || !('body' in n.ticketFields)) return n
      const { body: _, ...ticketFields } = n.ticketFields
      return { ...n, ticketFields }
    })
    this.send({
      type: 'update',
      bundle: { ...bundle, graph: { ...bundle.graph, nodes } },
      displayStatusGroups: view.displayStatusGroups,
      showOthersColumn: view.showOthersColumn,
      displayStatusGroupTooltips: view.displayStatusGroupTooltips,
      parsedEnabled,
      projectName: view.projectName,
      priorityOptionHints: view.priorityOptionHints,
      statusOptions: view.statusOptions,
      writableLevels: view.writableLevels,
      draft: {
        entries: entries.map((e, i) => {
          const s = view.changeStates[i]!
          const error = s.error ?? e.error
          return { change: e.change, state: s.state, label: changeLabel(e.change), ...(error ? { error } : {}) }
        }),
        canWrite: canWrite(cur.loaded),
        mode: writeBackMode(),
        writing: this.writing,
        adapter: cur.loaded.fullConfig.adapter,
      },
      restoredState: this.context.workspaceState.get<PersistedPanelState>(STATE_KEY_PANEL),
    })
  }

  private serial(fn: () => Promise<void>): Promise<void> {
    const run = this.queue.then(fn, fn)
    this.queue = run.catch(() => undefined)
    return run
  }

  private async edit(input: VertoChange) {
    const cur = this.current
    if (!cur) return
    const change = parseChange(input?.type === 'create' ? { ...input, nodeId: TEMP_ID_PREFIX } : input)
    if (!change) return this.refuse('Verto: that edit is not well-formed.')
    const r = await acceptEdit(cur.loaded, this.drafts.load(cur.key), change, this.parsedEnabled())
    if (this.current !== cur) return this.refuse('Verto: the project reloaded; edit not applied, try again.')
    if (!r.ok) return this.refuse(`Verto: edit not applied: ${r.error}`)
    await this.drafts.save(cur.key, r.entries)
    await this.render()
    if (writeBackMode() === 'immediate' && canWrite(cur.loaded)) await this.writeBack()
  }

  /** Warn, and re-send the view so the webview drops the refused edit from its inputs. */
  private async refuse(message: string) {
    void vscode.window.showWarningMessage(message)
    await this.render()
  }

  private async discard(input?: VertoChange[]) {
    const cur = this.current
    if (!cur) return
    const entries = this.drafts.load(cur.key)
    const drop = input?.map(parseChange).filter((c): c is VertoChange => c !== null)
    const kept = discardChanges(entries.map(e => e.change), drop)
    await this.drafts.save(cur.key, entries.filter(e => kept.includes(e.change)))
    await this.render()
  }

  /**
   * Write the whole draft (DESIGN.md §4.6.11): reload the tracker, rebuild the preview, abort if it
   * doesn't validate, write with the full config, add default mappings, keep the failed changes.
   */
  private async writeBack() {
    const cur = this.current
    if (!cur || this.writing || !canWrite(cur.loaded)) return
    const blocked = this.lastView && invalidReason(this.lastView)
    if (blocked) {
      void vscode.window.showWarningMessage(`Verto: not written: ${blocked}`)
      return
    }
    if (this.drafts.load(cur.key).length === 0) return
    this.writing = true
    await this.render()
    try {
      await this.writeFresh()
    } catch (err) {
      void vscode.window.showErrorMessage(`Verto: write failed: ${messageOf(err)}`)
    } finally {
      this.writing = false
    }
    await this.fetch()
  }

  /** The write itself, after a fresh reload (the draft's preview must still validate). */
  private async writeFresh() {
    const { config, workspaceFolder } = await loadConfig()
    const fresh = await loadProjectGraph(config, hostEnv(workspaceFolder, this.warnOnce))
    if (!fresh?.adapter.writeBack) return
    const key = projectKey(fresh.fullConfig)
    this.current = { loaded: fresh, key }
    const { view, entries } = viewWithDraft(fresh, this.drafts.load(key), this.parsedEnabled())
    await this.drafts.save(key, entries)
    const reason = invalidReason(view)
    if (reason) {
      void vscode.window.showWarningMessage(`Verto: not written: ${reason}`)
      return
    }
    if (entries.length === 0) return
    const result = await fresh.adapter.writeBack(fresh.fullConfig, entries.map(e => e.change), {
      confirm: request => this.confirmWrite(fresh.fullConfig.adapter, request),
    })
    const added = Object.keys(result.addMappings)
    if (added.length > 0) {
      try {
        await insertFieldMappings(getWorkspaceConfigPath(), fresh.fullConfig.adapter, result.addMappings)
      } catch (err) {
        void vscode.window.showErrorMessage(
          `Verto: couldn't add fieldMappings ${added.join(', ')} to verto.config.jsonc (${messageOf(err)}); add by hand: ${JSON.stringify(result.addMappings)}`,
        )
      }
    }
    const after = afterWrite(entries, result)
    await this.drafts.save(key, after.entries)
    if (after.shown.length > 0) {
      void vscode.window.showErrorMessage(
        `Verto: ${after.shown.length} change(s) not written: ${after.shown.map(e => `${changeLabel(e.change)}: ${e.error}`).join('; ')}`,
      )
    }
  }

  /** One modal for field registration + config mappings; a decline is remembered until the next Write back click. */
  private async confirmWrite(adapter: string, request: WriteConfirmation): Promise<boolean> {
    const id = JSON.stringify(request)
    if (this.declinedWrites.has(id)) return false
    const detail = [
      ...request.register.map(l => `Register ${adapter} field ${l}`),
      ...request.addMappings.map(l => `Add fieldMappings.${l} to verto.config.jsonc`),
    ].join('\n')
    const ok = (await vscode.window.showWarningMessage(
      'Verto: writing needs these setup changes.',
      { modal: true, detail },
      SET_UP_AND_WRITE,
    )) === SET_UP_AND_WRITE
    if (!ok) this.declinedWrites.add(id)
    return ok
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
