import type { DisplayStatusGroup } from '@verto/config'
import type { VertoNode } from '@verto/core'

export const OTHER_DISPLAY_STATUS_GROUP = 'Other'

/** Configured group labels plus the implicit Other bucket (single source of truth for table/bar headers). */
export function groupLabelsWithOther(groups: DisplayStatusGroup[]): string[] {
  return [...groups.map(g => g.label), OTHER_DISPLAY_STATUS_GROUP]
}

/** True when a display-status group entry marks satisfied/done state (structural predicate on config). */
export function isDoneBucket(group: DisplayStatusGroup): boolean {
  return group.sources.ticket?.isDone === true
      || group.sources.parsed?.isDone === true
}

export function resolveDisplayStatusGroup(
  row: Pick<VertoNode, 'nodeType' | 'isDone' | 'status'>,
  groups: DisplayStatusGroup[],
): string {
  for (const group of groups) {
    const rule = group.sources[row.nodeType as 'ticket' | 'parsed']
    if (!rule) continue

    const isDonePredicateMatch =
      rule.isDone !== undefined && row.isDone === rule.isDone

    const colIsDone = isDoneBucket(group)
    const statusMatch =
      rule.statuses !== undefined &&
      row.status !== undefined &&
      rule.statuses.includes(row.status) &&
      (colIsDone || row.isDone === false)

    if (isDonePredicateMatch || statusMatch) return group.label
  }
  return OTHER_DISPLAY_STATUS_GROUP
}

/** Gap callouts are one consumer of satisfied-group matching. */
export function isGap(
  row: Pick<VertoNode, 'nodeType' | 'isDone' | 'status'>,
  groups: DisplayStatusGroup[],
): boolean {
  return !groups
    .filter(isDoneBucket)
    .some(g => resolveDisplayStatusGroup(row, [g]) === g.label)
}
