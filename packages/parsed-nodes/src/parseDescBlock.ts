const BEGIN_MARKERS = new Set(['DESC:BEGIN', '<!-- DESC:BEGIN -->'])
const END_MARKERS   = new Set(['DESC:END',   '<!-- DESC:END -->'])

const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g

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
  return extracted || undefined
}
