export interface TextMatch {
  textIndex: number
  start: number
  end: number
}

/**
 * Case-insensitive, literal, non-overlapping matches of `query` within each text, in order.
 * Offsets index the original text (lowercasing first could change its length).
 */
export function findMatches(texts: string[], query: string): TextMatch[] {
  if (!query) return []
  const re = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu')
  const matches: TextMatch[] = []
  texts.forEach((text, textIndex) => {
    for (const m of text.matchAll(re)) {
      matches.push({ textIndex, start: m.index, end: m.index + m[0].length })
    }
  })
  return matches
}

/** Next (`dir` 1) or previous (-1) index, wrapping; from -1 starts at the first / last; -1 when empty. */
export function stepIndex(current: number, count: number, dir: 1 | -1): number {
  if (count === 0) return -1
  if (current === -1) return dir === 1 ? 0 : count - 1
  return (current + dir + count) % count
}
