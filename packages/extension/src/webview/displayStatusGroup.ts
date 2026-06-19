import type { DisplayStatusGroup } from '@verto/config'
import type { VertoNode } from '@verto/core'
import { nodeWeight } from '@verto/core'
import {
  groupLabelsForDisplay,
  resolveDisplayStatusGroup,
  resolveDisplayStatusGroupIndex,
  isGap,
  OTHER_DISPLAY_STATUS_GROUP,
  SYSTEM_DONE_DISPLAY_GROUP_LABEL,
  formatDisplayGroupsProse,
  shouldShowOthersColumn,
  buildStatusUniverse,
  type StatusUniverse,
} from '@verto/config/display-status-groups'
import { statusGroupColor } from './theme.js'

export {
  SYSTEM_DONE_DISPLAY_GROUP_LABEL,
  OTHER_DISPLAY_STATUS_GROUP,
  resolveDisplayStatusGroup,
  groupLabelsForDisplay,
  resolveDisplayStatusGroupIndex,
  isGap,
  formatDisplayGroupsProse,
  shouldShowOthersColumn,
  buildStatusUniverse,
  type StatusUniverse,
}

export type PillTone = 'success' | 'warning' | 'info' | 'neutral' | 'deleted' | 'danger'
export type TextTone = 'primary' | 'secondary' | 'tertiary' | 'quaternary'
export type StatTone = 'success' | 'warning' | 'info' | 'danger'

function emptyGroupRecord(userGroups: DisplayStatusGroup[]): Record<string, number> {
  return Object.fromEntries(
    groupLabelsForDisplay(userGroups, true).map(label => [label, 0]),
  ) as Record<string, number>
}

export function countByDisplayStatusGroup(
  rows: Iterable<Pick<VertoNode, 'nodeType' | 'isDone' | 'status'>>,
  userGroups: DisplayStatusGroup[],
): Record<string, number> {
  const counts = emptyGroupRecord(userGroups)
  for (const row of rows) {
    counts[resolveDisplayStatusGroup(row, userGroups)]++
  }
  return counts
}

export function weightByDisplayStatusGroup(
  rows: Iterable<VertoNode>,
  userGroups: DisplayStatusGroup[],
): Record<string, number> {
  const weights = emptyGroupRecord(userGroups)
  for (const row of rows) {
    weights[resolveDisplayStatusGroup(row, userGroups)] += nodeWeight(row)
  }
  return weights
}

export function summarizePipelineByDisplayGroup(
  rows: Iterable<VertoNode>,
  userGroups: DisplayStatusGroup[],
): { counts: Record<string, number>; weights: Record<string, number> } {
  const counts = emptyGroupRecord(userGroups)
  const weights = emptyGroupRecord(userGroups)
  for (const row of rows) {
    const label = resolveDisplayStatusGroup(row, userGroups)
    counts[label]++
    weights[label] += nodeWeight(row)
  }
  return { counts, weights }
}

export function formatDisplayGroupCounts(
  values: Record<string, number>,
  userGroups: DisplayStatusGroup[],
  showOthersColumn: boolean,
): string {
  return groupLabelsForDisplay(userGroups, showOthersColumn)
    .filter(label => (values[label] ?? 0) > 0)
    .map(label => `${values[label]} ${label}`)
    .join(' · ')
}

export function displayStatusGroupColorForNode(
  node: Pick<VertoNode, 'nodeType' | 'isDone' | 'status'>,
  userGroups: DisplayStatusGroup[],
): string {
  return statusGroupColor(resolveDisplayStatusGroupIndex(node, userGroups))
}

export function columnColorIndex(col: string, userGroups: DisplayStatusGroup[]): number {
  if (col === OTHER_DISPLAY_STATUS_GROUP) return -1
  if (col === SYSTEM_DONE_DISPLAY_GROUP_LABEL) return 0
  const userIdx = userGroups.findIndex(g => g.label === col)
  return userIdx < 0 ? -1 : userIdx + 1
}
