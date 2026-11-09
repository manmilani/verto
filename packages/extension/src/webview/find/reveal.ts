export interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

/** Anything that can move its content: a DOM scroll container or a pan region (the NCN graph). */
export interface Scroller {
  /** Visible area, in viewport coordinates. */
  box(): Box
  /** Moves the content by −(dx, dy) on screen; returns the shift actually applied. */
  shift(dx: number, dy: number): [number, number]
}

/**
 * Brings `rect` into view through `scrollers` (inner → outer): each one whose visible box doesn't
 * fully contain the rect on an axis centres it on that axis; outer scrollers see the moved rect.
 */
export function revealRect(rect: Box, scrollers: Scroller[]): void {
  let r = rect
  for (const s of scrollers) {
    const b = s.box()
    const dx = r.left >= b.left && r.right <= b.right ? 0 : centre(r.left, r.right) - centre(b.left, b.right)
    const dy = r.top >= b.top && r.bottom <= b.bottom ? 0 : centre(r.top, r.bottom) - centre(b.top, b.bottom)
    if (dx === 0 && dy === 0) continue
    const [ax, ay] = s.shift(dx, dy)
    r = { left: r.left - ax, right: r.right - ax, top: r.top - ay, bottom: r.bottom - ay }
  }
}

function centre(a: number, b: number): number {
  return (a + b) / 2
}
