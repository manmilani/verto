export interface ParsedRawReq {
  id: string       // '{parentId}#raw-req-{n}', 1-based
  name: string
  note?: string
  isDone: boolean
  status: 'raw' | 'done'
}

const BEGIN_MARKERS = new Set(['RAW_REQ:BEGIN', '<!-- RAW_REQ:BEGIN -->'])
const END_MARKERS   = new Set(['RAW_REQ:END',   '<!-- RAW_REQ:END -->'])

const CHECKLIST_RE = /^\s*-\s*\[([ xX])\]\s*(.+)/
const NUMERIC_PREFIX_RE = /^\d+\.\s*/
const PATTERN_A_RE = /^"([^"]+)":\s*(.*)/

export function parseRawReqBlock(body: string, parentId: string): ParsedRawReq[] {
  const lines = body.split('\n')

  let inBlock = false
  let blockLines: string[] = []

  for (const raw of lines) {
    const trimmed = raw.trimEnd().replace(/\r$/, '').trim()
    if (!inBlock) {
      if (BEGIN_MARKERS.has(trimmed)) { inBlock = true }
      continue
    }
    if (END_MARKERS.has(trimmed)) break
    blockLines.push(raw)
  }

  if (!inBlock) return []

  const results: ParsedRawReq[] = []
  let n = 0

  for (const line of blockLines) {
    const match = CHECKLIST_RE.exec(line)
    if (!match) continue
    n++

    const checked = match[1] !== ' '
    const rawText = match[2].trim()

    // Strip optional leading numeric prefix (e.g. "1. ", "2. ")
    const text = rawText.replace(NUMERIC_PREFIX_RE, '')

    let name: string
    let note: string | undefined

    const patternA = PATTERN_A_RE.exec(text)
    if (patternA) {
      name = patternA[1]
      note = patternA[2].trim() || undefined
    } else {
      name = text
      note = text
    }

    results.push({
      id: `${parentId}#raw-req-${n}`,
      name,
      note,
      status: checked ? 'done' : 'raw',
      isDone: (checked ? 'done' : 'raw') === 'done',
    })
  }

  return results
}
