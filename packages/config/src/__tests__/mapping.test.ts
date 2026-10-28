import { describe, it, expect } from 'vitest'
import { adapterFieldMappings, applyMappingTail, withoutMappings } from '../mapping.js'
import type { VertoConfig } from '../types.js'

describe('applyMappingTail', () => {
  it('passes the value through with no values/type', () => {
    expect(applyMappingTail('x', undefined, undefined)).toBe('x')
  })

  it('applies values; a miss gives null', () => {
    const values = { Epic: true, Task: false }
    expect(applyMappingTail('Epic', values, undefined)).toBe(true)
    expect(applyMappingTail('Task', values, undefined)).toBe(false)
    expect(applyMappingTail('Bug', values, undefined)).toBeNull()
    expect(applyMappingTail('constructor', values, undefined)).toBeNull()
  })

  it('coerces after values', () => {
    expect(applyMappingTail('High', { High: '2' }, 'number')).toBe(2)
    expect(applyMappingTail('7', undefined, 'number')).toBe(7)
  })

  it('works per list item; null items stay null', () => {
    expect(applyMappingTail(['a', null, 'b'], { a: 1 }, undefined)).toEqual([1, null, null])
    expect(applyMappingTail(['1', '2'], undefined, 'number')).toEqual([1, 2])
  })

  it('null/undefined stay null', () => {
    expect(applyMappingTail(null, { a: 1 }, 'number')).toBeNull()
    expect(applyMappingTail(undefined, undefined, undefined)).toBeNull()
  })
})

describe('withoutMappings / adapterFieldMappings', () => {
  const config: VertoConfig = {
    adapter: 'fissue',
    fissue: {
      root: 'r',
      fieldMappings: {
        a: { from: { kind: 'issueField', field: 'a' } },
        b: { from: { kind: 'issueField', field: 'b' } },
      },
    },
  }

  it('reads the named block', () => {
    expect(Object.keys(adapterFieldMappings(config)!)).toEqual(['a', 'b'])
    expect(adapterFieldMappings({ adapter: 'nope' })).toBeUndefined()
  })

  it('drops keys from the named block only, without mutating', () => {
    const out = withoutMappings(config, ['a'])
    expect(Object.keys(out.fissue!.fieldMappings!)).toEqual(['b'])
    expect(out.fissue!.root).toBe('r')
    expect(Object.keys(config.fissue!.fieldMappings!)).toEqual(['a', 'b'])
  })

  it('returns the same config when nothing to drop', () => {
    expect(withoutMappings(config, [])).toBe(config)
  })
})
