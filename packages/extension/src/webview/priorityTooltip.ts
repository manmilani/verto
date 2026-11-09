import { clampPriority, type PriorityChainsEntry, type VertoNode } from '@verto/core'
import { formatPriority } from './nodeStatusFormat.js'

/**
 * Priority pill tooltip: the "Priority rank" header, then the winning chain
 * (`145:  V2 (P1) → B (P4) → T (P5)`, top node first). With `showLosing`, all
 * kept chains (best first) plus "+N more" for chains not kept.
 */
export function priorityTooltip(
  rank: number | undefined,
  entry: PriorityChainsEntry | undefined,
  nodeById: Map<string, Pick<VertoNode, 'title' | 'priority'>>,
  showLosing: boolean,
): string {
  const lines = [`Priority rank ${formatPriority(rank)}`]
  const chains = (entry?.chains ?? []).slice(0, showLosing ? undefined : 1)
  for (const chain of chains) {
    const path = [...chain.nodeIds].reverse().map(id => {
      const node = nodeById.get(id)
      return node ? `${node.title} (P${clampPriority(node.priority)})` : id
    })
    lines.push(`${formatPriority(chain.score)}:  ${path.join(' → ')}`)
  }
  const more = showLosing && entry ? entry.total - chains.length : 0
  if (more > 0) lines.push(`+${more} more`)
  return lines.join('\n')
}
