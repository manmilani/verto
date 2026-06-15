import { describe, it, expect } from 'vitest'
import { parseDescBlock } from '../parseDescBlock.js'

describe('parseDescBlock', () => {
  it('returns undefined when no markers present', () => {
    expect(parseDescBlock('some text\nno markers here')).toBeUndefined()
  })

  it('returns undefined for empty body', () => {
    expect(parseDescBlock('')).toBeUndefined()
  })

  it('detects bare DESC:BEGIN/END markers', () => {
    const body = 'DESC:BEGIN\nThis is the description.\nDESC:END'
    expect(parseDescBlock(body)).toBe('This is the description.')
  })

  it('detects HTML-comment-wrapped markers', () => {
    const body = '<!-- DESC:BEGIN -->\nThis is the description.\n<!-- DESC:END -->'
    expect(parseDescBlock(body)).toBe('This is the description.')
  })

  it('strips HTML comments from extracted text', () => {
    const body = 'DESC:BEGIN\nText <!-- hidden --> visible\nDESC:END'
    expect(parseDescBlock(body)).toBe('Text  visible')
  })

  it('returns trimmed result', () => {
    const body = 'DESC:BEGIN\n\n  Some description  \n\nDESC:END'
    expect(parseDescBlock(body)).toBe('Some description')
  })

  it('returns undefined when extracted text is empty after stripping', () => {
    const body = 'DESC:BEGIN\n<!-- all hidden -->\nDESC:END'
    expect(parseDescBlock(body)).toBeUndefined()
  })

  it('multi-line content is captured', () => {
    const body = 'DESC:BEGIN\nLine one\nLine two\nDESC:END'
    expect(parseDescBlock(body)).toBe('Line one\nLine two')
  })
})
