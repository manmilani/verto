import type { VertoGraph } from '../types.js'

export interface GlobalPriorityRankingOptions {
  /**
   * Minimum digit count for normalisation. When set, D = max(actualMaxDepth, minDepthFloor).
   * Decouples per-node computation from a full graph scan for live incremental estimates.
   * Default: undefined — use the actual graph max depth.
   * See DESIGN.md §3.5.
   */
  minDepthFloor?: number
}

/**
 * Derives a canonical global priority ranking value for every node using the
 * chain-traversal algorithm from DESIGN.md §3.5.
 *
 * Lower value = higher priority (do first).
 *
 * Algorithm summary:
 * 1. From each node N, traverse upward (following dependents) along all paths.
 * 2. Generate a result at each DeliverySlice encountered AND at the top of each
 *    path. If the top is a DeliverySlice both triggers coincide — one result.
 * 3. raw = P(n0)×10⁰ + P(n1)×10¹ + … + P(nk)×10^k  (n0 = N, nk = top of chain)
 * 4. normalised = raw × 10^(D−k)  where D = max depth in graph
 * 5. canonical value for N = min of all normalised results across all chains.
 *
 * Priority values must be in [1, 9] (see types.ts). Values outside this range
 * are clamped to keep positional encoding stable.
 */
export function globalPriorityRanking(
  graph: VertoGraph,
  opts?: GlobalPriorityRankingOptions,
): Record<string, number> {
  if (graph.nodes.length === 0) return {}

  const nodeById = new Map(graph.nodes.map(n => [n.id, n]))

  // dependents[id] = ids of nodes that have id as a direct prerequisite
  const dependents = new Map<string, string[]>()
  for (const node of graph.nodes) dependents.set(node.id, [])
  for (const node of graph.nodes) {
    for (const prereqId of node.prereqIds) {
      const list = dependents.get(prereqId)
      if (list) list.push(node.id)
    }
  }

  // Find D = max upward path depth from any node (memoised DFS)
  const depthMemo = new Map<string, number>()
  function maxDepthFrom(id: string): number {
    const cached = depthMemo.get(id)
    if (cached !== undefined) return cached
    depthMemo.set(id, 0) // cycle guard
    const ups = dependents.get(id) ?? []
    if (ups.length === 0) {
      depthMemo.set(id, 0)
      return 0
    }
    let max = 0
    for (const upId of ups) max = Math.max(max, maxDepthFrom(upId))
    const depth = 1 + max
    depthMemo.set(id, depth)
    return depth
  }
  let dActual = 0
  for (const node of graph.nodes) dActual = Math.max(dActual, maxDepthFrom(node.id))
  const D = opts?.minDepthFloor !== undefined ? Math.max(dActual, opts.minDepthFloor) : dActual

  const clamp = (p: number) => Math.min(9, Math.max(1, Math.round(p)))

  const rankings: Record<string, number> = {}

  for (const startNode of graph.nodes) {
    const results: number[] = []

    // DFS upward from startNode, collecting chain results.
    // chain: array of node ids from startNode (index 0) up to current node.
    // visiting: guards against cycles.
    const dfs = (chain: string[], visiting: Set<string>) => {
      const currentId = chain[chain.length - 1]
      const currentNode = nodeById.get(currentId)!
      const k = chain.length - 1

      const computeNormalised = (): number => {
        let raw = 0
        for (let i = 0; i < chain.length; i++) {
          raw += clamp(nodeById.get(chain[i])!.priority) * Math.pow(10, i)
        }
        return raw * Math.pow(10, D - k)
      }

      const ups = (dependents.get(currentId) ?? []).filter(id => !visiting.has(id))
      const isTop = ups.length === 0

      // Trigger 1: DeliverySlice encountered (generate result; traversal continues)
      if (currentNode.isDeliverySlice) {
        results.push(computeNormalised())
      }

      // Trigger 2: Top of path and NOT a DeliverySlice (one result, not two)
      if (isTop && !currentNode.isDeliverySlice) {
        results.push(computeNormalised())
      }

      // Traverse never terminates early — continue upward
      for (const upId of ups) {
        visiting.add(upId)
        chain.push(upId)
        dfs(chain, visiting)
        chain.pop()
        visiting.delete(upId)
      }
    }

    const visiting = new Set<string>([startNode.id])
    dfs([startNode.id], visiting)

    rankings[startNode.id] = results.length > 0 ? Math.min(...results) : clamp(startNode.priority) * Math.pow(10, D)
  }

  return rankings
}
