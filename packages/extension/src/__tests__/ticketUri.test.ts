import { describe, it, expect } from 'vitest'
import { ticketUri } from '../host/ticketUri.js'

describe('ticketUri', () => {
  it('file: drops the fragment, keeps an encoded # in the name', () => {
    expect(ticketUri('file:///p/.fissue/tickets/P-1-a.md#raw-req-2')).toBe('file:///p/.fissue/tickets/P-1-a.md')
    expect(ticketUri('file:///p/a%23b.md')).toBe('file:///p/a%23b.md')
  })

  it('http(s) unchanged (fragment kept)', () => {
    expect(ticketUri('https://github.com/o/r/issues/1#raw-req-1')).toBe('https://github.com/o/r/issues/1#raw-req-1')
    expect(ticketUri('http://x/y')).toBe('http://x/y')
  })

  it('other schemes and junk → null', () => {
    expect(ticketUri('javascript:alert(1)')).toBeNull()
    expect(ticketUri('command:workbench.action.quit')).toBeNull()
    expect(ticketUri('not a url')).toBeNull()
    expect(ticketUri('verto-draft:new:1')).toBeNull()
  })
})
