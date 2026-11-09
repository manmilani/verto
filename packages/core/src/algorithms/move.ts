import type { VertoGraph, VertoNode } from '../types.js'
import {
  clampPriority, globalPriorityRanking, priorityChains, type GlobalPriorityRankingOptions,
} from './priority.js'
import { implementationOrder } from './order.js'
import { leverageScores } from './leverage.js'
import { closureFor } from './closure.js'

export interface MoveEdit { nodeId: string; from: number; to: number }

export interface MovePlan {
  /** Empty = already there, or no placement better than the current one. */
  edits: MoveEdit[]
  /** X lands at the drop: no row (other than its prerequisites / dependents) on the wrong side. */
  exact: boolean
  /** X's 0-based row in the resulting implementation order. */
  index: number
  /** X's resulting priority rank. */
  rank: number
}

/**
 * Nearest digit string to `bound` with digit i (weight 10^i) taken from `allowed[i]` (ascending):
 * the largest ≤ bound (`atMost`) or the smallest ≥ bound (`atLeast`). Returns digits by position,
 * or undefined when none exists.
 */
export function nearestDigits(
  bound: number,
  allowed: readonly (readonly number[])[],
  dir: 'atMost' | 'atLeast',
): number[] | undefined {
  const len = allowed.length
  if (len === 0 || allowed.some(a => a.length === 0)) return undefined
  const max = allowed.map(a => a[a.length - 1]!)
  const min = allowed.map(a => a[0]!)
  const value = (d: number[]) => d.reduce((s, x, i) => s + x * 10 ** i, 0)
  if (dir === 'atMost') {
    if (bound >= value(max)) return max
    if (bound < value(min)) return undefined
  } else {
    if (bound <= value(min)) return min
    if (bound > value(max)) return undefined
  }
  // value(min) ≤ bound ≤ value(max): bound has exactly `len` digits.
  const b = Array.from({ length: len }, (_, i) => Math.floor(bound / 10 ** i) % 10)
  let tight = 0
  while (tight < len && allowed[len - 1 - tight]!.includes(b[len - 1 - tight]!)) tight++
  if (tight === len) return b
  for (let t = tight; t >= 0; t--) {
    const pos = len - 1 - t
    const options = allowed[pos]!
    const pick = dir === 'atMost'
      ? [...options].reverse().find(d => d < b[pos]!)
      : options.find(d => d > b[pos]!)
    if (pick === undefined) continue
    return b.map((d, i) => (i > pos ? d : i === pos ? pick : dir === 'atMost' ? max[i]! : min[i]!))
  }
  return undefined
}

interface Chain { nodeIds: string[]; scale: number }

/**
 * Priority edits that move work-item `id` to `gap` (0..n) in the implementation order with the least
 * change of its priority rank (DESIGN.md §3.5, "Reordering by drag-and-drop"). Only nodes in `id`'s
 * chains change; `allowed(node)` lists the levels a node may be set to ([] = not editable). Every
 * candidate is judged by recomputing the ranking and the order.
 */
export function planMove(
  graph: VertoGraph,
  id: string,
  gap: number,
  allowed: (node: VertoNode) => readonly number[],
  opts?: GlobalPriorityRankingOptions,
): MovePlan {
  const nodeById = new Map(graph.nodes.map(n => [n.id, n]))
  const leverage = leverageScores(graph)
  const simulate = (g: VertoGraph) => {
    const ranking = globalPriorityRanking(g, opts)
    return { order: implementationOrder(g, ranking, leverage), rank: ranking[id] ?? Infinity }
  }

  const start = simulate(graph)
  const startIndex = start.order.indexOf(id)
  const noMove: MovePlan = { edits: [], exact: true, index: startIndex, rank: start.rank }
  if (startIndex < 0) return noMove

  const above = new Set(start.order.slice(0, gap))
  const fixed = closureFor(graph, id, nodeById)
  const downward = [id]
  while (downward.length > 0) {
    const cur = downward.pop()!
    for (const n of graph.nodes) {
      if (n.prereqIds.includes(cur) && !fixed.has(n.id)) {
        fixed.add(n.id)
        downward.push(n.id)
      }
    }
  }
  const judge = (order: string[]) => {
    const at = order.indexOf(id)
    let tooHigh = 0
    let tooLow = 0
    order.forEach((n, i) => {
      if (fixed.has(n)) return
      if (above.has(n) && i > at) tooLow++
      if (!above.has(n) && i < at) tooHigh++
    })
    return { tooHigh, tooLow, misplaced: tooHigh + tooLow, at }
  }
  const initial = judge(start.order)
  if (initial.misplaced === 0) return noMove
  const up = initial.tooHigh > 0

  // Every chain of X: the DFS walks all paths anyway; the count grows with the number of paths.
  const chains: Chain[] = (priorityChains(graph, { ...opts, ids: [id], limit: Infinity })[id]?.chains ?? [])
    .map(c => {
      const raw = c.nodeIds.reduce((s, n, i) => s + clampPriority(nodeById.get(n)!.priority) * 10 ** i, 0)
      return { nodeIds: c.nodeIds, scale: Math.round(c.score / raw) }
    })
  if (chains.length === 0) return { ...noMove, exact: false }

  const original = new Map<string, number>()
  for (const c of chains) for (const n of c.nodeIds) original.set(n, clampPriority(nodeById.get(n)!.priority))
  const chainCount = new Map<string, number>()
  for (const c of chains) for (const n of new Set(c.nodeIds)) chainCount.set(n, (chainCount.get(n) ?? 0) + 1)

  type Digits = Map<string, number>
  const score = (c: Chain, d: Digits) => c.scale * c.nodeIds.reduce((s, n, i) => s + d.get(n)! * 10 ** i, 0)
  const trueRank = (d: Digits) => Math.min(...chains.map(c => score(c, d)))
  const editCount = (d: Digits) => [...d].filter(([n, v]) => v !== original.get(n)).length
  /** Levels for chain position `pos`: positions above `top` keep their digit. */
  const levels = (n: string, pos: number, top: number, current: number, riseOnly: boolean) => {
    if (pos > top) return [current]
    const set = new Set([...allowed(nodeById.get(n)!), current])
    return [...set].filter(l => !riseOnly || l >= current).sort((a, b) => a - b)
  }
  const write = (c: Chain, d: Digits, digits: number[]) => c.nodeIds.forEach((n, i) => d.set(n, digits[i]!))

  const realizeUp = (v: number, top: number): Digits | undefined => {
    let best: { d: Digits; rank: number; edits: number } | undefined
    for (const c of chains) {
      const digits = nearestDigits(
        Math.floor(v / c.scale),
        c.nodeIds.map((n, i) => levels(n, i, top, original.get(n)!, false)),
        'atMost',
      )
      if (!digits) continue
      const d = new Map(original)
      write(c, d, digits)
      const cand = { d, rank: trueRank(d), edits: editCount(d) }
      if (!best || cand.rank > best.rank || (cand.rank === best.rank && cand.edits < best.edits)) best = cand
    }
    return best?.d
  }
  const ascending = [...chains].sort((a, b) => score(a, original) - score(b, original))
  const realizeDown = (v: number, top: number, riseOnly: boolean): Digits | undefined => {
    const d = new Map(original)
    for (const c of ascending) {
      if (score(c, d) >= v) continue
      const digits = nearestDigits(
        Math.ceil(v / c.scale),
        c.nodeIds.map((n, i) => levels(n, i, top, d.get(n)!, riseOnly && chainCount.get(n)! > 1)),
        'atLeast',
      )
      if (!digits) return undefined
      write(c, d, digits)
    }
    return chains.every(c => score(c, d) >= v) ? d : undefined
  }
  const realize = (v: number, top: number) =>
    up ? realizeUp(v, top) : realizeDown(v, top, false) ?? realizeDown(v, top, true)

  interface Candidate {
    d: Digits; reached: boolean; misplaced: number; delta: number; edits: number; distance: number
    index: number; rank: number
  }
  const probed = new Map<string, Candidate>()
  const probe = (d: Digits, v: number): Candidate => {
    const key = [...d.values()].join(',')
    const known = probed.get(key)
    if (known) return known
    const sim = simulate(withPriorities(graph, d, original))
    const j = judge(sim.order)
    const cand: Candidate = {
      d, reached: up ? j.tooHigh === 0 : j.tooLow === 0, misplaced: j.misplaced,
      delta: Math.abs(sim.rank - start.rank), edits: editCount(d), distance: Math.abs(v - start.rank),
      index: j.at, rank: sim.rank,
    }
    probed.set(key, cand)
    return cand
  }
  /** True once X is past every row in the direction of travel, or when `v` can't be realised. */
  const farEnough = (v: number, top: number): boolean => {
    const d = realize(v, top)
    return !d || probe(d, v).reached
  }

  // 1. Nearest first: walk X's realisable ranks outward from R₀, so the first exact placement is the
  //    least change. Rows sharing an edited upper node move along with X, which makes placement
  //    non-monotone in the rank; the walk doesn't rely on monotonicity.
  const maxLen = Math.max(...chains.map(c => c.nodeIds.length))
  let v = up ? start.rank - 1 : start.rank + 1
  for (let i = 0; i < NEAREST_PROBES && v > 0; i++) {
    const d = realize(v, maxLen - 1)
    if (!d) break
    if (probe(d, v).misplaced === 0) return result()
    const r = trueRank(d)
    v = up ? r - 1 : r + 1
  }

  // 2. Far moves: one binary search per significance level (chain positions 0..top may change),
  //    each on its own (near-)monotone predicate; the best probed placement wins.
  const maxScale = Math.max(...chains.map(c => c.scale))
  for (let top = 0; top < maxLen; top++) {
    const reach = maxScale * 10 ** (top + 1)
    if (up) {
      let lo = Math.max(1, start.rank - reach)
      let hi = start.rank - 1
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2)
        if (farEnough(mid, top)) lo = mid + 1
        else hi = mid - 1
      }
    } else {
      let lo = start.rank + 1
      let hi = start.rank + reach
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2)
        if (farEnough(mid, top)) hi = mid - 1
        else lo = mid + 1
      }
    }
  }

  return result()

  function result(): MovePlan {
    let best: Candidate | undefined
    for (const c of probed.values()) {
      if (!best || compare(c, best) < 0) best = c
    }
    if (!best || best.misplaced >= initial.misplaced) return { ...noMove, exact: false }
    const edits = [...best.d]
      .filter(([n, p]) => p !== original.get(n))
      .map(([n, p]) => ({ nodeId: n, from: nodeById.get(n)!.priority, to: p }))
    return { edits, exact: best.misplaced === 0, index: best.index, rank: best.rank }
  }
}

/** Simulations spent on the nearest-first walk before the per-level binary searches take over. */
const NEAREST_PROBES = 100

function compare(
  a: { misplaced: number; delta: number; edits: number; distance: number },
  b: { misplaced: number; delta: number; edits: number; distance: number },
): number {
  return a.misplaced - b.misplaced || a.delta - b.delta || a.edits - b.edits || a.distance - b.distance
}

function withPriorities(graph: VertoGraph, d: Map<string, number>, original: Map<string, number>): VertoGraph {
  return {
    ...graph,
    nodes: graph.nodes.map(n => {
      const v = d.get(n.id)
      return v === undefined || v === original.get(n.id) ? n : { ...n, priority: v }
    }),
  }
}
