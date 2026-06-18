import type { DisplayStatusGroup } from '@verto/config'
import type { VertoNode } from '@verto/core'

export type PillTone = 'success' | 'warning' | 'info' | 'neutral' | 'deleted' | 'danger'
export type TextTone = 'primary' | 'secondary' | 'tertiary' | 'quaternary'
export type StatTone = 'success' | 'warning' | 'info' | 'danger'

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

/**
 * Returns the zero-based index of the display group that matches the given node row,
 * or -1 when the node falls into the Other bucket. Useful for palette lookups.
 */
export function resolveDisplayStatusGroupIndex(
  row: Pick<VertoNode, 'nodeType' | 'isDone' | 'status'>,
  groups: DisplayStatusGroup[],
): number {
  const label = resolveDisplayStatusGroup(row, groups)
  if (label === OTHER_DISPLAY_STATUS_GROUP) return -1
  return groups.findIndex(g => g.label === label)
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

/** Comma-separated prose list of configured display groups for page descriptions. */
export function formatDisplayGroupsProse(groups: DisplayStatusGroup[]): string {
  const labels = [...groups.map(g => g.label), OTHER_DISPLAY_STATUS_GROUP]
  if (labels.length === 0) return 'in a configured delivery state'
  if (labels.length === 1) return labels[0]
  return `${labels.slice(0, -1).join(', ')}, or ${labels[labels.length - 1]}`
}

/** Maps a node to a canvas-style pill tone for tables and graph pills. */
export function pillToneForNode(
  node: Pick<VertoNode, 'nodeType' | 'isDone' | 'status'>,
  groups: DisplayStatusGroup[],
): PillTone {
  if (node.isDone) return 'success'
  if (isGap(node, groups)) return 'deleted'
  const idx = resolveDisplayStatusGroupIndex(node, groups)
  if (idx < 0) return 'neutral'
  if (idx === 0) return 'warning'
  if (idx === 1) return 'info'
  return 'info'
}
