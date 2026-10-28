import { describe, it, expect } from 'vitest'
import { interpret } from '../values.js'
import type { FissueFieldDef } from '../system_types.js'

const def = (type: FissueFieldDef['type'], isArray = false): FissueFieldDef => ({ type, isArray })

describe('interpret', () => {
  it('text/date/select pass the string through', () => {
    expect(interpret(def('text'), 'hi')).toBe('hi')
    expect(interpret(def('date'), 'not a date')).toBe('not a date')
    expect(interpret(def('select'), 'Nope')).toBe('Nope')
  })

  it.each([
    ['5', 5],
    ['-1.5', -1.5],
    ['1e3', 1000],
    ['0o17', 15],
    ['0x1F', 31],
    ['.inf', null],
    ['.nan', null],
    [' 5 ', null],
    ['0b101', null],
    ['five', null],
  ])('number %j → %j (fissue YAML 1.2 syntax)', (raw, want) => {
    expect(interpret(def('number'), raw)).toBe(want)
  })

  it('boolean: YAML 1.2 core forms only', () => {
    expect(interpret(def('boolean'), 'True')).toBe(true)
    expect(interpret(def('boolean'), 'FALSE')).toBe(false)
    expect(interpret(def('boolean'), 'yes')).toBeNull()
  })

  it('arrays: list of strings per item; a string becomes a one-item list', () => {
    expect(interpret(def('number', true), ['1', 'x'])).toEqual([1, null])
    expect(interpret(def('text', true), 'a')).toEqual(['a'])
  })

  it('rejected shapes give null', () => {
    expect(interpret(def('text'), ['a'])).toBeNull()
    expect(interpret(def('text', true), ['a', null])).toBeNull()
    expect(interpret(def('text', true), [['a']])).toBeNull()
    expect(interpret(def('text'), { a: 'b' })).toBeNull()
  })

  it('an undefined key is text: string or list of strings', () => {
    expect(interpret(undefined, 'x')).toBe('x')
    expect(interpret(undefined, ['x', 'y'])).toEqual(['x', 'y'])
    expect(interpret(undefined, { a: 'b' })).toBeNull()
  })

  it('absent/null → null', () => {
    expect(interpret(def('text'), undefined)).toBeNull()
    expect(interpret(def('text', true), null)).toBeNull()
  })
})
