import * as vscode from 'vscode'
import type { FissueApiV1 } from '@verto/adapter-fissue'

const FISSUE_EXTENSION_ID = 'manmilani.fissue'

/** The fissue extension's exported API (fissue DESIGN.md §7). The adapter checks its version. */
export async function getFissueApi(): Promise<FissueApiV1> {
  const ext = vscode.extensions.getExtension<FissueApiV1>(FISSUE_EXTENSION_ID)
  if (!ext) {
    throw new Error("Verto: The fissue extension isn't installed or is disabled. Install its .vsix (or enable it), then refresh.")
  }
  return ext.activate()
}
