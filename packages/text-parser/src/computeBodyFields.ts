import type { VertoGraph } from '@verto/core'
import { parseDescBlock } from './parseDescBlock.js'

/**
 * Populates `_note` and `_outcome` on every ticket node that has a DESC:BEGIN/END
 * block in `ticketFields.body`. Both fields receive the first paragraph of the block.
 *
 * - `_note`    — displayed as the note for a child ticket's pipeline row in the
 *                parent slice's Delivery Map.
 * - `_outcome` — displayed in the slice header when the node is the selected slice.
 *
 * Parsed nodes (`nodeType: 'parsed'`) are skipped — their `_note` is set by
 * materializeParsedRequirements from the raw requirement line text.
 *
 * Not idempotent in a strict sense but safe to call once per pipeline run.
 * Never mutates the input graph.
 */
export function computeBodyFields(graph: VertoGraph): VertoGraph {
  const nodes = graph.nodes.map(node => {
    if (node.nodeType !== 'ticket') return node
    const body = node.ticketFields?.['body']
    if (typeof body !== 'string' || !body) return node
    const desc = parseDescBlock(body)
    if (desc === undefined) return node
    return { ...node, _note: desc, _outcome: desc }
  })
  return { nodes, edges: graph.edges }
}
