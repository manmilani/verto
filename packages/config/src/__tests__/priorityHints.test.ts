import { describe, it, expect } from 'vitest'
import {
  buildPriorityOptionHints,
  formatPriorityOptionHint,
  formatPriorityOptionLabel,
} from '../priorityHints.js'

describe('buildPriorityOptionHints', () => {
  it('inverts values map from tracker label to Verto level', () => {
    const hints = buildPriorityOptionHints({
      from: { kind: 'projectV2', field: 'Priority' },
      type: 'select',
      values: { Critical: 1, High: 3, Medium: 5, Low: 7, Deferred: 9 },
    })
    expect(hints).toEqual({
      1: 'Critical',
      3: 'High',
      5: 'Medium',
      7: 'Low',
      9: 'Deferred',
    })
  })

  it('joins multiple tracker labels mapped to the same level', () => {
    const hints = buildPriorityOptionHints({
      from: { kind: 'projectV2', field: 'Priority' },
      values: { highest: 1, critical: 1 },
    })
    expect(hints[1]).toBe('highest / critical')
  })

  it('returns empty object when mapping or values are absent', () => {
    expect(buildPriorityOptionHints(undefined)).toEqual({})
    expect(buildPriorityOptionHints({ from: { kind: 'projectV2', field: 'Priority' } })).toEqual({})
  })
})

describe('formatPriorityOptionHint', () => {
  const hints = buildPriorityOptionHints({
    from: { kind: 'projectV2', field: 'Priority' },
    values: { high: 2, medium: 5, low: 8 },
  })

  it('prefers mapped tracker label over built-in fallback', () => {
    expect(formatPriorityOptionHint(5, hints)).toBe('medium')
  })

  it('uses built-in fallbacks when no mapping exists for that level', () => {
    expect(formatPriorityOptionHint(1, hints)).toBe('most important')
    expect(formatPriorityOptionHint(9, hints)).toBe('least important')
    expect(formatPriorityOptionHint(4, hints)).toBeUndefined()
  })
})

describe('formatPriorityOptionLabel', () => {
  it('formats label with P prefix and hint in parentheses', () => {
    expect(formatPriorityOptionLabel(3, { 3: 'high' })).toBe('P3 (high)')
    expect(formatPriorityOptionLabel(6, {})).toBe('P6')
    expect(formatPriorityOptionLabel(1, {})).toBe('P1 (most important)')
  })
})
