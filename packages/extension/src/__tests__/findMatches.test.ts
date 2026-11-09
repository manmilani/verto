import { describe, it, expect } from 'vitest'
import { findMatches, stepIndex } from '../webview/find/findMatches.js'

describe('findMatches', () => {
  it('is case-insensitive', () => {
    expect(findMatches(['Login API'], 'api')).toEqual([{ textIndex: 0, start: 6, end: 9 }])
  })

  it('finds several per text and across texts, in order', () => {
    expect(findMatches(['ab ab', 'x', 'AB'], 'ab')).toEqual([
      { textIndex: 0, start: 0, end: 2 },
      { textIndex: 0, start: 3, end: 5 },
      { textIndex: 2, start: 0, end: 2 },
    ])
  })

  it('is non-overlapping', () => {
    expect(findMatches(['aaa'], 'aa')).toHaveLength(1)
  })

  it('treats regex characters literally', () => {
    expect(findMatches(['a.b (x)', 'acb'], '.b (')).toEqual([{ textIndex: 0, start: 1, end: 5 }])
  })

  it('offsets index the original text for non-ASCII case', () => {
    expect(findMatches(['İİ ä Ä'], 'ä')).toEqual([
      { textIndex: 0, start: 3, end: 4 },
      { textIndex: 0, start: 5, end: 6 },
    ])
  })

  it('empty query → no matches', () => {
    expect(findMatches(['abc'], '')).toEqual([])
  })
})

describe('stepIndex', () => {
  it('wraps forward and backward', () => {
    expect(stepIndex(2, 3, 1)).toBe(0)
    expect(stepIndex(0, 3, -1)).toBe(2)
    expect(stepIndex(1, 3, 1)).toBe(2)
  })

  it('from -1 starts at the first or last', () => {
    expect(stepIndex(-1, 3, 1)).toBe(0)
    expect(stepIndex(-1, 3, -1)).toBe(2)
  })

  it('no matches → -1', () => {
    expect(stepIndex(0, 0, 1)).toBe(-1)
  })
})
