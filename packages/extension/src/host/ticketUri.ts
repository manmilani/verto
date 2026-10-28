/**
 * The URI to open for a node's `ticketUrl` (DESIGN.md §4.8), or null when it isn't openable.
 * Only http, https and file; a `file:` fragment (e.g. a parsed node's `#raw-req-n`) is dropped.
 */
export function ticketUri(url: string): string | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  if (u.protocol === 'file:') {
    u.hash = ''
    return u.href
  }
  return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null
}
