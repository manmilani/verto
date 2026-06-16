export function statusColor(status: string | undefined): string {
  switch (status) {
    case 'done':
    case 'closed':
      return 'var(--vscode-charts-green)'
    case 'In Progress':
      return 'var(--vscode-charts-orange)'
    case 'raw':
      return 'var(--vscode-charts-purple)'
    default:
      return 'var(--vscode-foreground)'
  }
}

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
