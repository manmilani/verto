import { describe, it, expect } from 'vitest'
import type { PriorityChainsEntry } from '@verto/core'
import { priorityTooltip } from '../webview/priorityTooltip.js'

const nodes = new Map([
  ['T', { title: 'T', priority: 5 }],
  ['A', { title: 'A', priority: 2 }],
  ['B', { title: 'B', priority: 4 }],
  ['V1', { title: 'V1', priority: 3 }],
  ['V2', { title: 'V2', priority: 1 }],
])

const entry: PriorityChainsEntry = {
  chains: [
    { nodeIds: ['T', 'B', 'V2'], score: 145 },
    { nodeIds: ['T', 'A', 'V1'], score: 325 },
  ],
  total: 2,
}

describe('priorityTooltip', () => {
  it('header + winning chain, top node first', () => {
    expect(priorityTooltip(145, entry, nodes, false)).toBe(
      'Priority rank 145\n145:  V2 (P1) → B (P4) → T (P5)',
    )
  })

  it('with losing chains: all kept chains, best first', () => {
    expect(priorityTooltip(145, entry, nodes, true)).toBe(
      'Priority rank 145\n145:  V2 (P1) → B (P4) → T (P5)\n325:  V1 (P3) → A (P2) → T (P5)',
    )
  })

  it('"+N more" for chains not kept, only when showing losing chains', () => {
    const many = { ...entry, total: 9 }
    expect(priorityTooltip(145, many, nodes, true).split('\n').at(-1)).toBe('+7 more')
    expect(priorityTooltip(145, many, nodes, false)).not.toContain('more')
  })

  it('strips normalisation zeros from chain scores', () => {
    const short = { chains: [{ nodeIds: ['B', 'V2'], score: 140 }], total: 1 }
    expect(priorityTooltip(140, short, nodes, false)).toBe('Priority rank 14\n14:  V2 (P1) → B (P4)')
  })

  it('no chains → header only', () => {
    expect(priorityTooltip(undefined, undefined, nodes, true)).toBe('Priority rank —')
    expect(priorityTooltip(145, undefined, nodes, true)).toBe('Priority rank 145')
  })
})
