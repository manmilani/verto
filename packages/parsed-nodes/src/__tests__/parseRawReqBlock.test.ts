import { describe, it, expect } from 'vitest'
import { parseRawReqBlock } from '../parseRawReqBlock.js'

describe('parseRawReqBlock', () => {
  it('returns [] when no markers present', () => {
    expect(parseRawReqBlock('some text\nno markers here', 'p1')).toEqual([])
  })

  it('returns [] for empty body', () => {
    expect(parseRawReqBlock('', 'p1')).toEqual([])
  })

  it('detects bare BEGIN marker', () => {
    const body = 'RAW_REQ:BEGIN\n- [ ] Item\nRAW_REQ:END'
    const result = parseRawReqBlock(body, 'p1')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Item')
  })

  it('detects HTML-comment-wrapped BEGIN/END markers', () => {
    const body = '<!-- RAW_REQ:BEGIN -->\n- [ ] Item\n<!-- RAW_REQ:END -->'
    const result = parseRawReqBlock(body, 'p1')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Item')
  })

  it('parses a single unchecked item as raw', () => {
    const body = 'RAW_REQ:BEGIN\n- [ ] My requirement\nRAW_REQ:END'
    const [req] = parseRawReqBlock(body, 'p1')
    expect(req.isDone).toBe(false)
    expect(req.status).toBe('raw')
  })

  it('parses a single checked item as done', () => {
    const body = 'RAW_REQ:BEGIN\n- [x] My requirement\nRAW_REQ:END'
    const [req] = parseRawReqBlock(body, 'p1')
    expect(req.isDone).toBe(true)
    expect(req.status).toBe('done')
  })

  it('accepts uppercase X as checked', () => {
    const body = 'RAW_REQ:BEGIN\n- [X] My requirement\nRAW_REQ:END'
    const [req] = parseRawReqBlock(body, 'p1')
    expect(req.isDone).toBe(true)
  })

  it('Pattern A: "Name": note description', () => {
    const body = 'RAW_REQ:BEGIN\n- [ ] "Foo": bar description\nRAW_REQ:END'
    const [req] = parseRawReqBlock(body, 'p1')
    expect(req.name).toBe('Foo')
    expect(req.note).toBe('bar description')
    expect(req.isDone).toBe(false)
  })

  it('Pattern A with numeric prefix: 1. "Name": note', () => {
    const body = 'RAW_REQ:BEGIN\n- [ ] 1. "Foo": bar\nRAW_REQ:END'
    const [req] = parseRawReqBlock(body, 'p1')
    expect(req.name).toBe('Foo')
    expect(req.note).toBe('bar')
  })

  it('Pattern B: plain text → name === note', () => {
    const body = 'RAW_REQ:BEGIN\n- [x] plain text\nRAW_REQ:END'
    const [req] = parseRawReqBlock(body, 'p1')
    expect(req.name).toBe('plain text')
    expect(req.note).toBe('plain text')
  })

  it('Pattern A with empty note after colon → note is undefined', () => {
    const body = 'RAW_REQ:BEGIN\n- [ ] "Name":\nRAW_REQ:END'
    const [req] = parseRawReqBlock(body, 'p1')
    expect(req.name).toBe('Name')
    expect(req.note).toBeUndefined()
  })

  it('multiple items have correct 1-based ids', () => {
    const body = [
      'RAW_REQ:BEGIN',
      '- [ ] "First": note one',
      '- [x] "Second": note two',
      '- [ ] plain third',
      'RAW_REQ:END',
    ].join('\n')
    const results = parseRawReqBlock(body, 'parent')
    expect(results).toHaveLength(3)
    expect(results[0].id).toBe('parent#raw-req-1')
    expect(results[1].id).toBe('parent#raw-req-2')
    expect(results[2].id).toBe('parent#raw-req-3')
  })

  it('non-checklist lines are silently skipped', () => {
    const body = [
      'RAW_REQ:BEGIN',
      'This is a comment line',
      '- [ ] Real item',
      'Another non-checklist line',
      'RAW_REQ:END',
    ].join('\n')
    const results = parseRawReqBlock(body, 'p1')
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('p1#raw-req-1')
    expect(results[0].name).toBe('Real item')
  })

  it('no END marker → parses to end of string (lenient)', () => {
    const body = 'RAW_REQ:BEGIN\n- [ ] Item one\n- [x] Item two'
    const results = parseRawReqBlock(body, 'p1')
    expect(results).toHaveLength(2)
    expect(results[0].name).toBe('Item one')
    expect(results[1].name).toBe('Item two')
  })

  it('text after END marker is not included', () => {
    const body = 'RAW_REQ:BEGIN\n- [ ] Included\nRAW_REQ:END\n- [ ] Excluded'
    const results = parseRawReqBlock(body, 'p1')
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('Included')
  })

  it('RAW_REQ:BEGIN substring in content does not trigger a false positive', () => {
    const body = 'This text mentions RAW_REQ:BEGIN in the middle of a line\n- [ ] Not a req'
    expect(parseRawReqBlock(body, 'p1')).toEqual([])
  })

  it('id uses parentId correctly', () => {
    const body = 'RAW_REQ:BEGIN\n- [ ] Req\nRAW_REQ:END'
    const [req] = parseRawReqBlock(body, 'I_abc123')
    expect(req.id).toBe('I_abc123#raw-req-1')
  })
})
