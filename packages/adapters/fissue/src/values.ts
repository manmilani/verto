import type { FissueFieldDef, FissueRaw } from './system_types.js'

/** fissue's YAML 1.2 core number syntax (fissue core `parseNumber`). */
const NUMBER_RES = [
  /^[-+]?(\.[0-9]+|[0-9]+(\.[0-9]*)?)([eE][-+]?[0-9]+)?$/,
  /^0o[0-7]+$/,
  /^0x[0-9a-fA-F]+$/,
]

function parseNumber(s: string): number | null {
  let n: number | null = null
  if (NUMBER_RES[0]!.test(s)) n = Number(s)
  else if (NUMBER_RES[1]!.test(s)) n = parseInt(s.slice(2), 8)
  else if (NUMBER_RES[2]!.test(s)) n = parseInt(s.slice(2), 16)
  return n !== null && Number.isFinite(n) ? n : null
}

const TRUE = new Set(['true', 'True', 'TRUE'])
const FALSE = new Set(['false', 'False', 'FALSE'])

type Scalar = string | number | boolean

function scalar(type: FissueFieldDef['type'], s: string): Scalar | null {
  switch (type) {
    case 'number': return parseNumber(s)
    case 'boolean': return TRUE.has(s) ? true : FALSE.has(s) ? false : null
    default: return s
  }
}

/**
 * A ticket value by its fissue field definition (DESIGN.md §4.6.10). A key with no definition is
 * read as single-or-list text. A shape fissue would reject (a mapping, a list in a single field,
 * a list item that isn't a string) gives `null` for the whole value.
 */
export function interpret(def: FissueFieldDef | undefined, raw: FissueRaw | undefined): Scalar | Scalar[] | (Scalar | null)[] | null {
  if (raw === null || raw === undefined) return null
  const type = def?.type ?? 'text'
  const isArray = def ? def.isArray : true
  if (typeof raw === 'string') {
    const v = scalar(type, raw)
    return def?.isArray ? [v] as (Scalar | null)[] : v
  }
  if (Array.isArray(raw)) {
    if (!isArray || !raw.every((item): item is string => typeof item === 'string')) return null
    return raw.map(item => scalar(type, item))
  }
  return null
}
