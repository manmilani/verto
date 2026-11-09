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

/** Default number of best chains kept per node (the winning chain included). */
export const PRIORITY_CHAINS_LIMIT = 5

/**
 * One upward chain from a node: `nodeIds[0]` is the ranked node, the last id is
 * the node that triggered the result (a DeliverySlice or the top of a path).
 * `score` is the normalised value (DESIGN.md §3.5) — lower = higher priority.
 */
export interface PriorityChain {
  nodeIds: string[]
  score: number
}

export interface PriorityChainsEntry {
  /** Best chains, ascending by score; at most `limit`. */
  chains: PriorityChain[]
  /** Number of chains found for the node (before truncation to `limit`). */
  total: number
}

/**
 * "Floor to 1, cap to 9": truncate non-integers downward, then enforce range.
 * Math.round is intentionally avoided — 2.6 should floor to 2, not round to 3.
 */
export function clampPriority(p: number): number {
  return Math.min(9, Math.max(1, Math.floor(p)))
}

function compareChains(a: PriorityChain, b: PriorityChain): number {
  if (a.score !== b.score) return a.score - b.score
  const ka = a.nodeIds.join('\u0000')
  const kb = b.nodeIds.join('\u0000')
  return ka < kb ? -1 : ka > kb ? 1 : 0
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
  return rankingFromChains(priorityChains(graph, { ...opts, limit: 1 }))
}

/** Canonical ranking value per node = score of its best chain. */
export function rankingFromChains(chains: Record<string, PriorityChainsEntry>): Record<string, number> {
  const rankings: Record<string, number> = {}
  for (const [id, entry] of Object.entries(chains)) {
    if (entry.chains.length > 0) rankings[id] = entry.chains[0].score
  }
  return rankings
}

/**
 * Every node's best upward chains (DESIGN.md §3.5), ascending by score (ties by
 * joined `nodeIds`, code-unit order), at most `limit` kept, plus the total count.
 * Every node has at least one chain: each path top produces a result.
 */
export function priorityChains(
  graph: VertoGraph,
  opts?: GlobalPriorityRankingOptions & { limit?: number },
): Record<string, PriorityChainsEntry> {
  if (graph.nodes.length === 0) return {}
  const limit = Math.max(1, opts?.limit ?? PRIORITY_CHAINS_LIMIT)

  const nodeById = new Map(graph.nodes.map(n => [n.id, n]))

  // dependents[id] = ids of nodes that have id as a direct prerequisite
  const dependents = new Map<string, string[]>()
  for (const node of graph.nodes) dependents.set(node.id, [])
  for (const node of graph.nodes) {
    for (const prereqId of new Set(node.prereqIds)) {
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

  // Note: positional encoding via Math.pow(10, i) overflows Number.MAX_SAFE_INTEGER
  // when D > ~15. Real backlogs are unlikely to reach this; minDepthFloor makes it
  // configurable, so large values should be avoided in incremental-estimation mode.
  const result: Record<string, PriorityChainsEntry> = {}

  for (const startNode of graph.nodes) {
    // Best `limit` chains, kept sorted; a chain is copied only when it is kept.
    const kept: PriorityChain[] = []
    let total = 0
    const addResult = (chain: string[], score: number) => {
      total++
      const candidate = { nodeIds: chain, score }
      if (kept.length === limit && compareChains(candidate, kept[kept.length - 1]) >= 0) return
      let i = kept.length
      while (i > 0 && compareChains(candidate, kept[i - 1]) < 0) i--
      kept.splice(i, 0, { nodeIds: [...chain], score })
      if (kept.length > limit) kept.pop()
    }

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
          raw += clampPriority(nodeById.get(chain[i])!.priority) * Math.pow(10, i)
        }
        return raw * Math.pow(10, D - k)
      }

      const ups = (dependents.get(currentId) ?? []).filter(id => !visiting.has(id))
      const isTop = ups.length === 0

      // Trigger 1: DeliverySlice encountered (generate result; traversal continues)
      if (currentNode.isDeliverySlice) {
        addResult(chain, computeNormalised())
      }

      // Trigger 2: Top of path and NOT a DeliverySlice (one result, not two)
      if (isTop && !currentNode.isDeliverySlice) {
        addResult(chain, computeNormalised())
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

    result[startNode.id] = { chains: kept, total }
  }

  return result
}
