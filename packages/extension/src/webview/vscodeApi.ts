import type { WebviewToHostMessage } from '../shared/protocol.js'

declare function acquireVsCodeApi(): { postMessage(msg: WebviewToHostMessage): void }

export const vscode = acquireVsCodeApi()
