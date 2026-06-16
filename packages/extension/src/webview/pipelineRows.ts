import type { VertoNode, VertoGraph } from '@verto/core'

export function buildPipelineForSlice(
  sliceId: string,
  graph: VertoGraph,
  implementationOrder: string[],
): VertoNode[] {
  const nodeById = new Map(graph.nodes.map(n => [n.id, n]))
  const slice = nodeById.get(sliceId)
  if (!slice) return []

  const orderIndex = new Map(implementationOrder.map((id, i) => [id, i]))

  // Child tickets sorted by: impl order position, then created_at, then id
  const children = slice.childIds
    .map(id => nodeById.get(id))
    .filter((n): n is VertoNode => n !== undefined)
    .sort((a, b) => {
      const ai = orderIndex.get(a.id) ?? Infinity
      const bi = orderIndex.get(b.id) ?? Infinity
      if (ai !== bi) return ai - bi
      const ac = a.created_at ?? '￿'
      const bc = b.created_at ?? '￿'
      if (ac !== bc) return ac < bc ? -1 : 1
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    })

  // Raw requirement nodes appended in _rawReqIds array order
  const rawNodes = slice._rawReqIds
    .map(id => nodeById.get(id))
    .filter((n): n is VertoNode => n !== undefined)

  return [...children, ...rawNodes]
}
