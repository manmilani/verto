import { describe, it, expect } from 'vitest'
import { nearestDigits, planMove } from '../algorithms/move.js'
import { priorityChains } from '../algorithms/priority.js'
import type { VertoNode } from '../types.js'
import { node, edge, graph } from './helpers.js'

const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9]
const any = (_: VertoNode) => ALL
/** Digits by position (10^i) → number. */
const num = (d: number[] | undefined) => d?.reduce((s, x, i) => s + x * 10 ** i, 0)

describe('nearestDigits', () => {
  it('largest ≤ / smallest ≥ the bound, skipping zero digits', () => {
    expect(num(nearestDigits(340, [ALL, ALL, ALL], 'atMost'))).toBe(339)
    expect(num(nearestDigits(345, [ALL, ALL, ALL], 'atMost'))).toBe(345)
    expect(num(nearestDigits(350, [ALL, ALL, ALL], 'atLeast'))).toBe(351)
    expect(num(nearestDigits(352, [ALL, ALL, ALL], 'atLeast'))).toBe(352)
  })

  it('restricted and fixed positions (backtracking)', () => {
    // units fixed at 5, tens any, hundreds fixed at 3: largest ≤ 352 is 345
    expect(num(nearestDigits(352, [[5], ALL, [3]], 'atMost'))).toBe(345)
    // smallest ≥ 352 with units only 1 or 9: 359
    expect(num(nearestDigits(352, [[1, 9], ALL, [3]], 'atLeast'))).toBe(359)
    // fixed top digit 3: nothing ≥ 400
    expect(nearestDigits(400, [ALL, ALL, [3]], 'atLeast')).toBeUndefined()
  })

  it('length edge cases', () => {
    expect(nearestDigits(99, [ALL, ALL, ALL], 'atMost')).toBeUndefined() // below 111
    expect(num(nearestDigits(5000, [ALL, ALL, ALL], 'atMost'))).toBe(999)
    expect(num(nearestDigits(5, [ALL, ALL, ALL], 'atLeast'))).toBe(111)
    expect(nearestDigits(1000, [ALL, ALL, ALL], 'atLeast')).toBeUndefined()
  })
})

describe('priorityChains ids option', () => {
  it('returns the same chains for those ids as the full run', () => {
    const g = graph(
      [node('J', { isDeliverySlice: true, priority: 3 }), node('M', { priority: 4 }), node('X'), node('Y', { priority: 2 })],
      [edge('X', 'M'), edge('M', 'J'), edge('Y', 'J')],
    )
    const all = priorityChains(g, { limit: Infinity })
    const only = priorityChains(g, { ids: ['X'], limit: Infinity })
    expect(Object.keys(only)).toEqual(['X'])
    expect(only.X).toEqual(all.X)
  })
})

/** Siblings X 5, B 6, C 7, E 9 under M 4 under journey J 3: ranks 345, 346, 347, 349. */
function siblings(over: Partial<Record<string, Partial<VertoNode>>> = {}) {
  const ids = { X: 5, B: 6, C: 7, E: 9 }
  return graph(
    [
      node('J', { isDeliverySlice: true, priority: 3, ...over.J }),
      node('M', { priority: 4, ...over.M }),
      ...Object.entries(ids).map(([id, p]) => node(id, { priority: p, ...over[id] })),
    ],
    [...Object.keys(ids).map(id => edge(id, 'M')), edge('M', 'J')],
  )
}

describe('planMove', () => {
  it('drop onto its own position → no edits', () => {
    expect(planMove(siblings(), 'X', 0, any)).toMatchObject({ edits: [], exact: true, index: 0 })
    expect(planMove(siblings(), 'X', 1, any)).toMatchObject({ edits: [], exact: true, index: 0 })
  })

  it('down by its own digit only (lowest significance) when enough', () => {
    const plan = planMove(siblings(), 'X', 3, any) // below C
    expect(plan.edits).toEqual([{ nodeId: 'X', from: 5, to: 7 }])
    expect(plan).toMatchObject({ exact: true, index: 2, rank: 347 })
  })

  it("siblings sharing the parent move with it, so only X's digit can pass them", () => {
    const plan = planMove(siblings(), 'X', 4, any) // below E (above M, its dependent)
    expect(plan.edits).toEqual([{ nodeId: 'X', from: 5, to: 9 }])
    expect(plan).toMatchObject({ exact: true, index: 3 })
  })

  it('up by its own digit; ties resolved by the order (id)', () => {
    const plan = planMove(siblings(), 'E', 0, any) // above X: E 345 ties X, E wins on id
    expect(plan.edits).toEqual([{ nodeId: 'E', from: 9, to: 5 }])
    expect(plan).toMatchObject({ exact: true, index: 0 })
  })

  it('out-of-range stored priorities that stay unchanged are no edits', () => {
    const plan = planMove(siblings({ E: { priority: 12 } }), 'X', 3, any)
    expect(plan.edits).toEqual([{ nodeId: 'X', from: 5, to: 7 }])
  })

  /** X 5 → M 4 → J 3 (345); Q → J. */
  function tens(q: number, over: Partial<Record<string, Partial<VertoNode>>> = {}) {
    return graph(
      [
        node('J', { isDeliverySlice: true, priority: 3 }), node('M', { priority: 4, ...over.M }),
        node('X'), node('Q', { priority: q }),
      ],
      [edge('X', 'M'), edge('M', 'J'), edge('Q', 'J')],
    )
  }

  it('up needs the tens digit: 345 → 339 (least numerical change)', () => {
    const plan = planMove(tens(4), 'X', 0, any) // above Q (340)
    expect(plan.edits).toEqual([{ nodeId: 'X', from: 5, to: 9 }, { nodeId: 'M', from: 4, to: 3 }])
    expect(plan).toMatchObject({ exact: true, index: 0, rank: 339 })
  })

  it('down needs the tens digit: 345 → 351', () => {
    const g = tens(5) // Q 350; order X, M, Q, J
    const plan = planMove(g, 'X', 3, any) // below Q
    expect(plan.edits).toEqual([{ nodeId: 'X', from: 5, to: 1 }, { nodeId: 'M', from: 4, to: 5 }])
    expect(plan).toMatchObject({ exact: true, rank: 351 })
  })

  it('a parsed node is never edited; unreachable → no edits', () => {
    const g = tens(4, { M: { nodeType: 'parsed' } })
    const plan = planMove(g, 'X', 0, n => (n.nodeType === 'ticket' ? ALL : []))
    expect(plan.edits).toEqual([])
    expect(plan.exact).toBe(false)
  })

  it('siblings move along with a shared parent: least change keeps X ahead of them (345 → 335)', () => {
    // Q 340 above X 345. M 4→3 lifts B, C, E too (336, 337, 339), so 339 (X 9) isn't enough; 335 is.
    const g = graph(
      [...siblings().nodes, node('Q', { priority: 4 })],
      [...siblings().edges, edge('Q', 'J')],
    )
    const plan = planMove(g, 'X', 0, any)
    expect(plan.edits).toEqual([{ nodeId: 'M', from: 4, to: 3 }])
    expect(plan).toMatchObject({ exact: true, index: 0, rank: 335 })
  })

  it('a journey-level change when nothing lower reaches', () => {
    const g = graph(
      [
        node('J', { isDeliverySlice: true, priority: 3 }), node('M', { priority: 1 }), node('X'),
        node('Q', { priority: 1 }), node('K', { isDeliverySlice: true, priority: 3 }),
      ],
      [edge('X', 'M'), edge('M', 'J'), edge('Q', 'K')],
    )
    // X 315 vs Q 31 → 310: Q first; passing Q needs X < 310 → J 3→2 (295 nearest is 299)
    const plan = planMove(g, 'X', 0, any)
    expect(plan.exact).toBe(true)
    expect(plan.rank).toBe(299)
  })

  it('X blocked behind its prerequisite: lowering X pulls P along', () => {
    // P 9 → X 5 → J 3 (X 350, P 359); n 2 → K 5 → L 3 (n 352). Order n, K, L, P, X, J.
    const g = graph(
      [
        node('J', { isDeliverySlice: true, priority: 3 }), node('X'), node('P', { priority: 9 }),
        node('L', { priority: 3 }), node('K', { priority: 5 }), node('n', { priority: 2 }),
      ],
      [edge('P', 'X'), edge('X', 'J'), edge('n', 'K'), edge('K', 'L')],
    )
    const plan = planMove(g, 'X', 0, any)
    expect(plan.edits).toEqual([{ nodeId: 'X', from: 5, to: 4 }])
    expect(plan.exact).toBe(true)
  })

  it('up through a non-winning chain when the winning journey is fixed', () => {
    // X 5 → J1 2 (25, fixed) and X → J2 3 (35); R 2 (20). Order R, X, …
    const g = graph(
      [node('J1', { priority: 2 }), node('J2', { priority: 3 }), node('X'), node('R', { priority: 2 })],
      [edge('X', 'J1'), edge('X', 'J2')],
    )
    const plan = planMove(g, 'X', 0, n => (n.id === 'J1' ? [] : ALL))
    expect(plan.edits).toEqual([{ nodeId: 'X', from: 5, to: 9 }, { nodeId: 'J2', from: 3, to: 1 }])
    expect(plan).toMatchObject({ exact: true, index: 0, rank: 19 })
  })

  it('far move beyond the nearest-first walk: found by the per-level search', () => {
    // X 5 → A 5 → B 5 → J 5 (5555); Q 1 → K 5 (5100). Passing Q needs < 5100: 4999 (J 5→4).
    const g = graph(
      [
        node('J', { isDeliverySlice: true }), node('B'), node('A'), node('X'),
        node('K', { isDeliverySlice: true }), node('Q', { priority: 1 }),
      ],
      [edge('X', 'A'), edge('A', 'B'), edge('B', 'J'), edge('Q', 'K')],
    )
    const plan = planMove(g, 'X', 0, any)
    expect(plan).toMatchObject({ exact: true, index: 0, rank: 4999 })
    expect(plan.edits.map(e => [e.nodeId, e.to])).toEqual([['X', 9], ['A', 9], ['B', 9], ['J', 4]])
  })

  it('down raises every chain below the target (min over chains)', () => {
    // X 5 → J1 3 (35) and X → J2 4 (45); R 4 (40). Order X, J1, J2, R.
    const g = graph(
      [node('J1', { priority: 3 }), node('J2', { priority: 4 }), node('X'), node('R', { priority: 4 })],
      [edge('X', 'J1'), edge('X', 'J2')],
    )
    const plan = planMove(g, 'X', 4, any) // below R
    expect(plan.edits).toEqual([{ nodeId: 'X', from: 5, to: 1 }, { nodeId: 'J1', from: 3, to: 4 }])
    expect(plan).toMatchObject({ exact: true, rank: 41 })
  })
})
