import { describe, it, expect } from 'vitest'
import { globalPriorityRanking } from '../algorithms/priority.js'
import { node, edge, graph } from './helpers.js'

describe('globalPriorityRanking', () => {
  it('empty graph returns empty object', () => {
    expect(globalPriorityRanking(graph([]))).toEqual({})
  })

  it('isolated delivery slice: score = priority × 10^0 (D=0)', () => {
    const g = graph([node('A', { priority: 3, isDeliverySlice: true })])
    const r = globalPriorityRanking(g)
    // D=0, chain=[A], k=0, raw=3, normalised=3×10^0=3
    expect(r['A']).toBe(3)
  })

  it('isolated non-delivery-slice: score = priority × 10^D (D=0)', () => {
    const g = graph([node('A', { priority: 7 })])
    const r = globalPriorityRanking(g)
    expect(r['A']).toBe(7)
  })

  it('linear chain with delivery slice at top — normalisation + positional encoding', () => {
    // A(p=1) → B(p=2) → C(p=3, DS)
    // D = 2
    // A: chain [A,B,C], k=2, raw=1+20+300=321, norm=321×10^0=321
    // B: chain [B,C],   k=1, raw=2+30=32,       norm=32×10^1=320
    // C: chain [C],     k=0, raw=3,              norm=3×10^2=300
    const g = graph(
      [
        node('A', { priority: 1 }),
        node('B', { priority: 2 }),
        node('C', { priority: 3, isDeliverySlice: true }),
      ],
      [edge('A', 'B'), edge('B', 'C')],
    )
    const r = globalPriorityRanking(g)
    expect(r['A']).toBe(321)
    expect(r['B']).toBe(320)
    expect(r['C']).toBe(300)
    // Lower = higher priority: C > B > A
    expect(r['C']).toBeLessThan(r['B'])
    expect(r['B']).toBeLessThan(r['A'])
  })

  it('diamond: minimum across chains determines ranking', () => {
    // A(p=5) → B(p=2) → D(p=5,DS); A → C(p=7) → D
    // D_actual = 2
    // D: chain [D], DS+top, k=0, raw=5, norm=5×100=500
    // B: chain [B,D], k=1, raw=2+50=52, norm=52×10=520
    // C: chain [C,D], k=1, raw=7+50=57, norm=57×10=570
    // A via B→D: chain [A,B,D], k=2, raw=5+20+500=525, norm=525
    // A via C→D: chain [A,C,D], k=2, raw=5+70+500=575, norm=575
    // A = min(525,575) = 525
    const g = graph(
      [
        node('A', { priority: 5 }),
        node('B', { priority: 2 }),
        node('C', { priority: 7 }),
        node('D', { priority: 5, isDeliverySlice: true }),
      ],
      [edge('A', 'B'), edge('A', 'C'), edge('B', 'D'), edge('C', 'D')],
    )
    const r = globalPriorityRanking(g)
    expect(r['D']).toBe(500)
    expect(r['B']).toBe(520)
    expect(r['C']).toBe(570)
    expect(r['A']).toBe(525) // best chain = through B
  })

  it('node with multiple delivery slices above it takes the minimum', () => {
    // X(p=1) → DS1(p=1, DS); X → DS2(p=9, DS)
    // D_actual = 1
    // X via DS1: chain [X,DS1], DS1 triggers, k=1, raw=1+10=11, norm=11
    // X via DS2: chain [X,DS2], DS2 triggers, k=1, raw=1+90=91, norm=91
    // X = min(11, 91) = 11
    const g = graph(
      [
        node('X', { priority: 1 }),
        node('DS1', { priority: 1, isDeliverySlice: true }),
        node('DS2', { priority: 9, isDeliverySlice: true }),
      ],
      [edge('X', 'DS1'), edge('X', 'DS2')],
    )
    const r = globalPriorityRanking(g)
    expect(r['X']).toBe(11) // best chain = through DS1
    expect(r['DS1']).toBe(10) // D=1, DS at k=0, raw=1, norm=1×10=10
    expect(r['DS2']).toBe(90) // raw=9, norm=9×10=90
  })

  it('intermediate delivery slice generates a result AND traversal continues', () => {
    // N(p=2) → DS(p=1,DS) → Top(p=5, not DS, top)
    // D = 2
    // N via DS (trigger 1, DS at k=1): raw=2+10=12, norm=12×10=120
    // N via Top (trigger 2, top non-DS at k=2): raw=2+10+500=512, norm=512
    // N = min(120, 512) = 120
    const g = graph(
      [
        node('N', { priority: 2 }),
        node('DS', { priority: 1, isDeliverySlice: true }),
        node('Top', { priority: 5 }),
      ],
      [edge('N', 'DS'), edge('DS', 'Top')],
    )
    const r = globalPriorityRanking(g)
    expect(r['N']).toBe(120)
  })

  it('minDepthFloor option pads all scores to at least the floor depth', () => {
    // Single DS node, D_actual=0 without floor
    // With minDepthFloor=2: D=2, score = p×10^2
    const g = graph([node('A', { priority: 3, isDeliverySlice: true })])
    const r = globalPriorityRanking(g, { minDepthFloor: 2 })
    expect(r['A']).toBe(300)
  })

  it('fully done graph: scores computed the same (done status does not affect ranking)', () => {
    const g = graph(
      [
        node('A', { priority: 1, isDone: true }),
        node('B', { priority: 2, isDone: true, isDeliverySlice: true }),
      ],
      [edge('A', 'B')],
    )
    const r = globalPriorityRanking(g)
    // D=1; B at k=0 raw=2, norm=2×10=20; A→B k=1 raw=1+20=21, norm=21
    expect(r['B']).toBe(20)
    expect(r['A']).toBe(21)
  })

  it('all-delivery-slices graph: each DS scores from its own chain', () => {
    // A(p=1,DS) prereq for B(p=2,DS). D=1.
    // B: chain=[B], DS+top, k=0; raw=2; norm=2×10^1=20.
    // A: DFS starts at A.
    //   A is DS (k=0) → trigger: raw=1, norm=1×10^1=10.
    //   Continue up to B: chain=[A,B], k=1.
    //   B is DS → trigger: raw=1+20=21, norm=21×10^0=21.
    //   B is also top but is DS → one result (already counted).
    //   A = min(10, 21) = 10.
    // A(10) < B(20): A has higher global priority, matching P(A)=1 < P(B)=2.
    const g = graph(
      [node('A', { priority: 1, isDeliverySlice: true }), node('B', { priority: 2, isDeliverySlice: true })],
      [edge('A', 'B')],
    )
    const r = globalPriorityRanking(g)
    expect(r['B']).toBe(20)
    expect(r['A']).toBe(10) // DS at start: chain=[A], norm=p×10^D=1×10=10
    expect(r['A']).toBeLessThan(r['B']) // A(p=1) outranks B(p=2)
  })
})
