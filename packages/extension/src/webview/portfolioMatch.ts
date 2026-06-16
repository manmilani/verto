import type { PortfolioColumn } from '@verto/config'
import type { VertoNode } from '@verto/core'

export function isDoneBucket(column: PortfolioColumn): boolean {
  return column.sources.ticket?.isDone === true
      || column.sources.parsed?.isDone === true
}

export function assignPortfolioColumn(
  row: Pick<VertoNode, 'nodeType' | 'isDone' | 'status'>,
  columns: PortfolioColumn[],
): string {
  for (const column of columns) {
    const rule = column.sources[row.nodeType as 'ticket' | 'parsed']
    if (!rule) continue

    const isDonePredicateMatch =
      rule.isDone !== undefined && row.isDone === rule.isDone

    const colIsDone = isDoneBucket(column)
    const statusMatch =
      rule.statuses !== undefined &&
      rule.statuses.includes(row.status ?? '') &&
      (colIsDone || row.isDone === false)

    if (isDonePredicateMatch || statusMatch) return column.label
  }
  return 'Other'
}

export function isGap(
  row: Pick<VertoNode, 'nodeType' | 'isDone' | 'status'>,
  columns: PortfolioColumn[],
): boolean {
  return !columns
    .filter(isDoneBucket)
    .some(c => assignPortfolioColumn(row, [c]) === c.label)
}
