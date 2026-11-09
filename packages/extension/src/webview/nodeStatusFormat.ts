import type { DisplayStatusGroup } from '@verto/config'
import type { VertoNode } from '@verto/core'
import { resolveDisplayStatusGroup } from './displayStatusGroup.js'

/**
 * Returns a human-readable status string for a node using the configured
 * display-status groups. Format: "<group> (<raw status>)", or "<group>" when
 * there is no raw status or it equals the group label (case-insensitive).
 * Nodes matching no group use the "others" group.
 */
export function formatNodeStatus(
  node: Pick<VertoNode, 'nodeType' | 'isDone' | 'status'>,
  groups: DisplayStatusGroup[],
): string {
  const label = resolveDisplayStatusGroup(node, groups)
  const raw = node.status
  return raw && raw.toLowerCase() !== label.toLowerCase() ? `${label} (${raw})` : label
}

/**
 * Formats a globalPriorityRanking value for display. Strips trailing zeros so
 * e.g. 13200 → "132", 30000 → "3". Returns "—" when undefined.
 */
export function formatPriority(ranking: number | undefined): string {
  if (ranking === undefined) return '—'
  return String(ranking).replace(/0+$/, '') || '—'
}
