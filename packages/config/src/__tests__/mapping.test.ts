import { describe, it, expect } from 'vitest'
import {
  adapterFieldMappings,
  applyMappingTail,
  dotItemsDiff,
  readBack,
  reverseMappedValue,
  statusOptionsFor,
  withoutMappings,
  writableLevels,
} from '../mapping.js'
import type { FieldMappingEntry, VertoConfig } from '../types.js'

const entry = (e: Partial<FieldMappingEntry> = {}): FieldMappingEntry => ({
  from: { kind: 'issueField', field: 'f' },
  ...e,
})

describe('readBack', () => {
  it('applies the tail, then priority clamps', () => {
    expect(readBack('Urgent', entry({ values: { Urgent: 0 } }), 'priority')).toBe(1)
    expect(readBack('x', entry({ values: { y: 1 } }), 'priority')).toBeNull()
    expect(readBack('3', entry({ type: 'number' }), 'priority')).toBe(3)
    expect(readBack('Done', entry({ values: { Done: true } }), 'isDone')).toBe(true)
  })

  it('reads dot entries as text unless typed otherwise', () => {
    expect(readBack('a', entry({ from: { kind: 'issue', field: 'labels.persona' }, type: 'select' }), 'personas')).toBe('a')
  })
})

describe('reverseMappedValue', () => {
  it('passes the value through without values', () => {
    expect(reverseMappedValue(2, entry({ type: 'number' }), 'priority')).toEqual({ ok: true, value: 2 })
  })

  it('picks the first tracker value that reads back, including the clamp', () => {
    const e = entry({ values: { Urgent: 0, High: 2, Highest: 1 } })
    expect(reverseMappedValue(1, e, 'priority')).toEqual({ ok: true, value: 'Urgent' })
    expect(reverseMappedValue(2, e, 'priority')).toEqual({ ok: true, value: 'High' })
    const r = reverseMappedValue(4, e, 'priority')
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error).toContain('fieldMappings.priority.values')
  })

  it('maps list items one by one', () => {
    const e = entry({ values: { 'P-a': 'a', 'P-b': 'b' } })
    expect(reverseMappedValue(['b', 'a'], e, 'personas')).toEqual({ ok: true, value: ['P-b', 'P-a'] })
    expect(reverseMappedValue(['c'], e, 'personas').ok).toBe(false)
  })
})

describe('dotItemsDiff', () => {
  it('removes unwanted sub items and adds missing ones, leaving others', () => {
    expect(dotItemsDiff(['bug', 'persona:a', 'persona:b', 'persona'], 'persona', ['b', 'c'])).toEqual({
      add: ['persona:c'],
      remove: ['persona:a', 'persona'],
    })
    expect(dotItemsDiff(['persona:a'], 'persona', ['a'])).toEqual({ add: [], remove: [] })
  })
})

describe('statusOptionsFor / writableLevels', () => {
  it('reads tracker options through the status mapping', () => {
    expect(statusOptionsFor(['Todo', 'Doing'], undefined)).toEqual(['Todo', 'Doing'])
    expect(statusOptionsFor(['Todo', 'Doing', 'X'], entry({ values: { Todo: 'open', Doing: 'wip', X: 'wip' } })))
      .toEqual(['open', 'wip'])
  })

  it('lists the levels some tracker value reads back as', () => {
    expect(writableLevels(undefined)).toBeNull()
    expect(writableLevels(entry({ type: 'number' }))).toBeNull()
    expect(writableLevels(entry({ values: { Low: 7, Urgent: 0, High: 3, Bad: 'x' } }))).toEqual([1, 3, 7])
  })
})

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
