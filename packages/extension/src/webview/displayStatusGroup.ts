import type { DisplayStatusGroup } from '@verto/config'
import type { VertoNode } from '@verto/core'
import { nodeWeight } from '@verto/core'

export type PillTone = 'success' | 'warning' | 'info' | 'neutral' | 'deleted' | 'danger'
export type TextTone = 'primary' | 'secondary' | 'tertiary' | 'quaternary'
export type StatTone = 'success' | 'warning' | 'info' | 'danger'

export const OTHER_DISPLAY_STATUS_GROUP = 'others'

/** Union of ticket workflow statuses listed on non-done groups. */
export function configuredOpenTicketStatuses(groups: DisplayStatusGroup[]): Set<string> {
  const set = new Set<string>()
  for (const group of groups) {
    if (isDoneBucket(group)) continue
    group.sources.ticket?.statuses?.forEach(status => set.add(status))
  }
  return set
}

/** True when any row resolves to the implicit Other bucket. */
export function hasOtherDisplayGroupRows(
  rows: Iterable<Pick<VertoNode, 'nodeType' | 'isDone' | 'status'>>,
  groups: DisplayStatusGroup[],
): boolean {
  for (const row of rows) {
    if (resolveDisplayStatusGroup(row, groups) === OTHER_DISPLAY_STATUS_GROUP) return true
  }
  return false
}

/** True when an open ticket's workflow status is not listed on any non-done group. */
export function hasOpenTicketStatusOutsideConfiguredLists(
  rows: Iterable<Pick<VertoNode, 'nodeType' | 'isDone' | 'status'>>,
  groups: DisplayStatusGroup[],
): boolean {
  const configured = configuredOpenTicketStatuses(groups)
  if (configured.size === 0) return false
  for (const row of rows) {
    if (row.nodeType !== 'ticket' || row.isDone) continue
    if (row.status === undefined) continue
    if (!configured.has(row.status)) return true
  }
  return false
}

/** Whether portfolio/legend UI should surface the implicit Other bucket. */
export function shouldShowOtherColumn(
  groups: DisplayStatusGroup[],
  rows: Iterable<Pick<VertoNode, 'nodeType' | 'isDone' | 'status'>>,
): boolean {
  return hasOtherDisplayGroupRows(rows, groups)
    || hasOpenTicketStatusOutsideConfiguredLists(rows, groups)
}

/** Configured group labels for UI columns/legends; includes Other only when needed. */
export function groupLabelsForDisplay(
  groups: DisplayStatusGroup[],
  rows: Iterable<Pick<VertoNode, 'nodeType' | 'isDone' | 'status'>>,
): string[] {
  const labels = groups.map(g => g.label)
  if (
    shouldShowOtherColumn(groups, rows) &&
    !labels.includes(OTHER_DISPLAY_STATUS_GROUP)
  ) {
    labels.push(OTHER_DISPLAY_STATUS_GROUP)
  }
  return labels
}

/** Configured group labels plus the implicit Other bucket (for internal counting). */
export function groupLabelsWithOther(groups: DisplayStatusGroup[]): string[] {
  const labels = groups.map(g => g.label)
  if (!labels.includes(OTHER_DISPLAY_STATUS_GROUP)) {
    labels.push(OTHER_DISPLAY_STATUS_GROUP)
  }
  return labels
}

function emptyGroupRecord(groups: DisplayStatusGroup[]): Record<string, number> {
  return Object.fromEntries(
    groupLabelsWithOther(groups).map(label => [label, 0]),
  ) as Record<string, number>
}

/** True when a display-status group entry marks satisfied/done state (structural predicate on config). */
export function isDoneBucket(group: DisplayStatusGroup): boolean {
  return group.sources.ticket?.isDone === true
      || group.sources.parsed?.isDone === true
}

function sourceRuleMatches(
  row: Pick<VertoNode, 'nodeType' | 'isDone' | 'status'>,
  rule: { isDone?: boolean; statuses?: string[] },
  colIsDone: boolean,
): boolean {
  const isDonePredicateMatch =
    rule.isDone !== undefined && row.isDone === rule.isDone

  const hasStatuses = rule.statuses !== undefined && rule.statuses.length > 0
  const statusMatch =
    hasStatuses &&
    row.status !== undefined &&
    rule.statuses!.includes(row.status) &&
    (colIsDone ? row.isDone === true : row.isDone === false)

  // Non-done groups with an explicit status list: only listed statuses match.
  if (hasStatuses && !colIsDone) {
    return statusMatch
  }

  return isDonePredicateMatch || statusMatch
}

export function resolveDisplayStatusGroup(
  row: Pick<VertoNode, 'nodeType' | 'isDone' | 'status'>,
  groups: DisplayStatusGroup[],
): string {
  for (const group of groups) {
    const rule = group.sources[row.nodeType as 'ticket' | 'parsed']
    if (!rule) continue

    if (sourceRuleMatches(row, rule, isDoneBucket(group))) {
      return group.label
    }
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

/** Count rows per display group label (includes Other). Keys follow groupLabelsWithOther order. */
export function countByDisplayStatusGroup(
  rows: Iterable<Pick<VertoNode, 'nodeType' | 'isDone' | 'status'>>,
  groups: DisplayStatusGroup[],
): Record<string, number> {
  const counts = emptyGroupRecord(groups)
  for (const row of rows) {
    counts[resolveDisplayStatusGroup(row, groups)]++
  }
  return counts
}

/** Per-group weight sums (UsageBar segments and weighted summary text). */
export function weightByDisplayStatusGroup(
  rows: Iterable<VertoNode>,
  groups: DisplayStatusGroup[],
): Record<string, number> {
  const weights = emptyGroupRecord(groups)
  for (const row of rows) {
    weights[resolveDisplayStatusGroup(row, groups)] += nodeWeight(row)
  }
  return weights
}

/** Per-group node counts and weight sums in a single pass when both are needed. */
export function summarizePipelineByDisplayGroup(
  rows: Iterable<VertoNode>,
  groups: DisplayStatusGroup[],
): { counts: Record<string, number>; weights: Record<string, number> } {
  const counts = emptyGroupRecord(groups)
  const weights = emptyGroupRecord(groups)
  for (const row of rows) {
    const label = resolveDisplayStatusGroup(row, groups)
    counts[label]++
    weights[label] += nodeWeight(row)
  }
  return { counts, weights }
}

/** Prose summary of non-zero values in config order, e.g. "3 Done · 2 In Progress · 1 Other". */
export function formatDisplayGroupCounts(
  values: Record<string, number>,
  groups: DisplayStatusGroup[],
): string {
  return groupLabelsWithOther(groups)
    .filter(label => (values[label] ?? 0) > 0)
    .map(label => `${values[label]} ${label}`)
    .join(' · ')
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
  const labels = groups.map(g => g.label)
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
