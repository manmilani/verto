import type { FieldMappingEntry } from './types.js'

function coerceBoolean(raw: unknown): boolean | null {
  const s = String(raw).toLowerCase()
  if (s === 'true' || s === '1' || s === 'yes') return true
  if (s === 'false' || s === '0' || s === 'no') return false
  return null
}

export function coerceFieldValue(raw: unknown, type: FieldMappingEntry['type']): unknown {
  if (raw === null || raw === undefined) return null
  if (type === undefined) return raw
  switch (type) {
    case 'text':
      return typeof raw === 'string' ? raw : String(raw)
    case 'number': {
      const n = Number(raw)
      return Number.isFinite(n) ? n : null
    }
    case 'boolean':
      return coerceBoolean(raw)
    case 'date':
    case 'select':
    case 'iteration':
      return raw
  }
}
