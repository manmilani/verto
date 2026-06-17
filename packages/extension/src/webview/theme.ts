export function statusLabel(status: string | undefined): string {
  return status ?? '—'
}

export const CHART_COLORS = [
  'var(--vscode-charts-blue)',
  'var(--vscode-charts-orange)',
  'var(--vscode-charts-green)',
  'var(--vscode-charts-purple)',
  'var(--vscode-charts-yellow)',
  'var(--vscode-charts-red)',
]

export const OTHER_GROUP_COLOR = 'var(--vscode-descriptionForeground)'

/** Maps a display-group array index to its palette colour.
 *  groupIndex < 0 (Other bucket) → neutral descriptionForeground. */
export function statusGroupColor(groupIndex: number): string {
  if (groupIndex < 0) return OTHER_GROUP_COLOR
  return CHART_COLORS[groupIndex % CHART_COLORS.length]
}
