import type * as vscode from 'vscode'

const OVERLAY_KEY = 'verto.priorityOverlay'

export function loadOverlay(ctx: vscode.ExtensionContext): Record<string, number | null> {
  return ctx.workspaceState.get<Record<string, number | null>>(OVERLAY_KEY) ?? {}
}

export async function saveOverlay(
  ctx: vscode.ExtensionContext,
  overlay: Record<string, number | null>,
): Promise<void> {
  await ctx.workspaceState.update(OVERLAY_KEY, overlay)
}
