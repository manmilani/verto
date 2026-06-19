import { describe, it, expect } from 'vitest'
import { coerceFieldValue } from '../coerce.js'

describe('coerceFieldValue', () => {
  it('null/undefined passthrough before type switch → null', () => {
    expect(coerceFieldValue(null, 'text')).toBeNull()
    expect(coerceFieldValue(undefined, 'number')).toBeNull()
    expect(coerceFieldValue(null, 'boolean')).toBeNull()
  })

  it('type undefined → raw unchanged (adapter path)', () => {
    expect(coerceFieldValue('hello', undefined)).toBe('hello')
    expect(coerceFieldValue(42, undefined)).toBe(42)
    expect(coerceFieldValue(['a'], undefined)).toEqual(['a'])
  })

  it('type text → String coercion', () => {
    expect(coerceFieldValue('hello', 'text')).toBe('hello')
    expect(coerceFieldValue(42, 'text')).toBe('42')
  })

  it('type number → finite number or null', () => {
    expect(coerceFieldValue('1500', 'number')).toBe(1500)
    expect(coerceFieldValue(3.5, 'number')).toBe(3.5)
    expect(coerceFieldValue('n/a', 'number')).toBeNull()
  })

  describe('coerceBoolean', () => {
    it('"true"/"1"/"yes" → true', () => {
      expect(coerceFieldValue('true', 'boolean')).toBe(true)
      expect(coerceFieldValue('1', 'boolean')).toBe(true)
      expect(coerceFieldValue('yes', 'boolean')).toBe(true)
      expect(coerceFieldValue('TRUE', 'boolean')).toBe(true)
    })

    it('"false"/"0"/"no" → false', () => {
      expect(coerceFieldValue('false', 'boolean')).toBe(false)
      expect(coerceFieldValue('0', 'boolean')).toBe(false)
      expect(coerceFieldValue('no', 'boolean')).toBe(false)
    })

    it('unrecognised strings → null', () => {
      expect(coerceFieldValue('admin', 'boolean')).toBeNull()
      expect(coerceFieldValue('', 'boolean')).toBeNull()
      expect(coerceFieldValue('maybe', 'boolean')).toBeNull()
    })
  })

  it('type date/select/iteration → passthrough', () => {
    expect(coerceFieldValue('2024-01-01', 'date')).toBe('2024-01-01')
    expect(coerceFieldValue('In Progress', 'select')).toBe('In Progress')
    expect(coerceFieldValue('Sprint 1', 'iteration')).toBe('Sprint 1')
  })
})
