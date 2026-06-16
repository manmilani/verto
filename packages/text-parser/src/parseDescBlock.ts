const BEGIN_MARKERS = new Set(['DESC:BEGIN', '<!-- DESC:BEGIN -->'])
const END_MARKERS   = new Set(['DESC:END',   '<!-- DESC:END -->'])

const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g

/**
 * Extracts the first paragraph from a DESC:BEGIN/END block in a ticket body.
 * Strips HTML comments. Returns undefined when no DESC block is present.
 *
 * "First paragraph" = text up to the first blank line inside the block.
 * Used for both _note (child pipeline rows) and _outcome (slice header).
 */
export function parseDescBlock(body: string): string | undefined {
  const lines = body.split('\n')

  let inBlock = false
  const blockLines: string[] = []

  for (const raw of lines) {
    const trimmed = raw.trimEnd().replace(/\r$/, '').trim()
    if (!inBlock) {
      if (BEGIN_MARKERS.has(trimmed)) { inBlock = true }
      continue
    }
    if (END_MARKERS.has(trimmed)) break
    blockLines.push(raw)
  }

  if (!inBlock) return undefined

  const extracted = blockLines.join('\n').replace(HTML_COMMENT_RE, '').trim()
  if (!extracted) return undefined

  // Return only the first paragraph (up to the first blank line)
  const firstParagraph = extracted.split(/\n\s*\n/)[0].trim()
  return firstParagraph || undefined
}
