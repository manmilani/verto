import { findMatches } from './findMatches.js'
import { panRegionOf } from './panRegions.js'
import { revealRect, type Box, type Scroller } from './reveal.js'

/** Visible text under `root`; text clipped by `overflow: hidden` counts (it's rendered, just not in view). */
function collectTextNodes(root: Element): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement
      const visible = parent
        && !parent.closest('select, script, style')
        && parent.checkVisibility({ visibilityProperty: true })
      return visible ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    },
  })
  const nodes: Text[] = []
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text)
  return nodes
}

export function findRanges(root: Element, query: string): Range[] {
  const nodes = collectTextNodes(root)
  return findMatches(nodes.map(n => n.data), query).map(m => {
    const range = document.createRange()
    range.setStart(nodes[m.textIndex], m.start)
    range.setEnd(nodes[m.textIndex], m.end)
    return range
  })
}

const ALL = 'verto-find'
const CURRENT = 'verto-find-current'

export function paintHighlights(ranges: Range[], current: Range | undefined): void {
  if (typeof CSS === 'undefined' || !CSS.highlights) return
  CSS.highlights.set(ALL, new Highlight(...ranges))
  const currentHighlight = current ? new Highlight(current) : new Highlight()
  currentHighlight.priority = 1
  CSS.highlights.set(CURRENT, currentHighlight)
}

export function clearHighlights(): void {
  if (typeof CSS === 'undefined' || !CSS.highlights) return
  CSS.highlights.delete(ALL)
  CSS.highlights.delete(CURRENT)
}

export function revealRange(range: Range): void {
  const el = range.startContainer.parentElement
  // A range whose text was removed collapses and measures as an empty rect at (0, 0).
  if (!el?.isConnected || range.collapsed) return
  revealRect(range.getBoundingClientRect(), scrollersFor(el))
}

/** Every scroller from `el` up to the document, inner → outer; clip (`hidden`) boxes are skipped. */
function scrollersFor(el: Element): Scroller[] {
  const list: Scroller[] = []
  for (let a: Element | null = el; a; a = a.parentElement) {
    const pan = panRegionOf(a)
    if (pan) {
      const region = a
      list.push({ box: () => paddingBox(region), shift: (dx, dy) => { pan(dx, dy); return [dx, dy] } })
    } else if (a === document.scrollingElement) {
      list.push(windowScroller)
    } else {
      const style = getComputedStyle(a)
      const sx = scrolls(style.overflowX)
      const sy = scrolls(style.overflowY)
      if (sx || sy) list.push(elementScroller(a, sx, sy))
    }
  }
  return list
}

function scrolls(overflow: string): boolean {
  return overflow === 'auto' || overflow === 'scroll'
}

function paddingBox(el: Element): Box {
  const r = el.getBoundingClientRect()
  const left = r.left + el.clientLeft
  const top = r.top + el.clientTop
  return { left, top, right: left + el.clientWidth, bottom: top + el.clientHeight }
}

function elementScroller(el: Element, sx: boolean, sy: boolean): Scroller {
  return {
    box: () => paddingBox(el),
    shift: (dx, dy) => {
      const { scrollLeft, scrollTop } = el
      el.scrollBy({ left: sx ? dx : 0, top: sy ? dy : 0, behavior: 'instant' })
      return [el.scrollLeft - scrollLeft, el.scrollTop - scrollTop]
    },
  }
}

const windowScroller: Scroller = {
  box: () => ({ left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight }),
  shift: (dx, dy) => {
    const { scrollX, scrollY } = window
    window.scrollBy({ left: dx, top: dy, behavior: 'instant' })
    return [window.scrollX - scrollX, window.scrollY - scrollY]
  },
}
