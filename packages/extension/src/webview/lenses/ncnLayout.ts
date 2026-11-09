import type { VertoEdge } from '@verto/core'
import ELK from 'elkjs/lib/elk.bundled.js'

const elk = new ELK()

/**
 * ELK only decides the order of nodes inside each column (crossing minimisation).
 * Columns and all spacing come from `dependencyDepth` + `packColumns`.
 */
export const elkLayoutOptions: Record<string, string> = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.layered.layering.strategy': 'LONGEST_PATH_SOURCE',
  'elk.separateConnectedComponents': 'false',
}

export interface ColumnLayoutSpec {
  nodeWidth: number
  nodeHeight: number
  columnGap: number
  rowGap: number
  padding: number
}

export const NCN_LAYOUT: ColumnLayoutSpec = {
  nodeWidth: 200,
  nodeHeight: 60,
  columnGap: 90,
  rowGap: 16,
  padding: 28,
}

export interface PackedLayout {
  positions: Map<string, { x: number; y: number }>
  columns: { x: number; width: number }[]
  width: number
  height: number
}

/** ELK's crossing-minimised vertical order (`y`) per node id. */
export async function elkColumnOrder(nodeIds: string[], edges: VertoEdge[]): Promise<Map<string, number>> {
  const result = await elk.layout({
    id: 'root',
    layoutOptions: elkLayoutOptions,
    children: nodeIds.map(id => ({ id, width: NCN_LAYOUT.nodeWidth, height: NCN_LAYOUT.nodeHeight })),
    edges: edges.map((e, i) => ({ id: `e${i}`, sources: [e.from], targets: [e.to] })),
  })
  return new Map((result.children ?? []).map(c => [c.id, c.y ?? 0]))
}

/**
 * Longest path from a source for every node (`from` = prerequisite). Sources and
 * isolated nodes are 0. Kahn's algorithm, so it terminates on cycles too: nodes on
 * a cycle are never released and keep the depth reached so far.
 */
export function dependencyDepth(nodeIds: string[], edges: VertoEdge[]): Map<string, number> {
  const depth = new Map(nodeIds.map(id => [id, 0]))
  const inDegree = new Map(nodeIds.map(id => [id, 0]))
  const dependents = new Map<string, string[]>(nodeIds.map(id => [id, []]))
  for (const e of edges) {
    if (!depth.has(e.from) || !depth.has(e.to)) continue
    dependents.get(e.from)!.push(e.to)
    inDegree.set(e.to, inDegree.get(e.to)! + 1)
  }
  const queue = nodeIds.filter(id => inDegree.get(id) === 0)
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i]
    for (const next of dependents.get(id)!) {
      depth.set(next, Math.max(depth.get(next)!, depth.get(id)! + 1))
      inDegree.set(next, inDegree.get(next)! - 1)
      if (inDegree.get(next) === 0) queue.push(next)
    }
  }
  return depth
}

/**
 * Column = depth; inside a column nodes are ordered by `order` (ELK `y`, ties by id)
 * and stacked top-down with a uniform gap.
 */
export function packColumns(
  depth: Map<string, number>,
  order: Map<string, number>,
  spec: ColumnLayoutSpec,
): PackedLayout {
  const byColumn: string[][] = []
  for (const [id, col] of depth) (byColumn[col] ??= []).push(id)

  const positions = new Map<string, { x: number; y: number }>()
  const columns: { x: number; width: number }[] = []
  let maxRows = 0
  for (let col = 0; col < byColumn.length; col++) {
    const x = spec.padding + col * (spec.nodeWidth + spec.columnGap)
    columns.push({ x, width: spec.nodeWidth })
    const ids = (byColumn[col] ?? []).sort(
      (a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0) || a.localeCompare(b),
    )
    ids.forEach((id, row) => {
      positions.set(id, { x, y: spec.padding + row * (spec.nodeHeight + spec.rowGap) })
    })
    maxRows = Math.max(maxRows, ids.length)
  }

  return {
    positions,
    columns,
    width: 2 * spec.padding + columns.length * spec.nodeWidth + Math.max(0, columns.length - 1) * spec.columnGap,
    height: 2 * spec.padding + maxRows * spec.nodeHeight + Math.max(0, maxRows - 1) * spec.rowGap,
  }
}
