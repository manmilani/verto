import { describe, it, expect } from 'vitest'
import { revealRect, type Box, type Scroller } from '../webview/find/reveal.js'

/** A scroller with a fixed visible box; `limit` caps each axis' shift (scroll end). */
function scroller(box: Box, limit = Infinity) {
  const shifts: [number, number][] = []
  const s: Scroller = {
    box: () => box,
    shift: (dx, dy) => {
      const applied: [number, number] = [clamp(dx, limit), clamp(dy, limit)]
      shifts.push(applied)
      return applied
    },
  }
  return { s, shifts }
}

const clamp = (v: number, limit: number) => Math.max(-limit, Math.min(limit, v))
const box = (left: number, top: number, right: number, bottom: number): Box => ({ left, top, right, bottom })

describe('revealRect', () => {
  it('a fully visible rect moves nothing', () => {
    const a = scroller(box(0, 0, 100, 100))
    revealRect(box(10, 10, 20, 20), [a.s])
    expect(a.shifts).toEqual([])
  })

  it('centres the rect on the axes where it is not fully visible', () => {
    const a = scroller(box(0, 0, 100, 100))
    revealRect(box(10, 300, 20, 310), [a.s])
    expect(a.shifts).toEqual([[0, 255]])
    const b = scroller(box(0, 0, 100, 100))
    revealRect(box(-200, -50, -190, -40), [b.s])
    expect(b.shifts).toEqual([[-245, -95]])
  })

  it('a clamped shift leaves the remainder to the outer scroller', () => {
    const inner = scroller(box(0, 0, 100, 100), 100)
    const outer = scroller(box(0, 0, 100, 100))
    revealRect(box(0, 400, 10, 410), [inner.s, outer.s])
    expect(inner.shifts).toEqual([[0, 100]])
    // the rect is now at 300..310 → the outer one centres it
    expect(outer.shifts).toEqual([[0, 255]])
  })

  it('pan region then a short scroll container: both shift', () => {
    const graph = scroller(box(0, 0, 1000, 720))
    const panel = scroller(box(0, 0, 1000, 300))
    revealRect(box(1500, 100, 1600, 140), [graph.s, panel.s])
    expect(graph.shifts).toEqual([[1050, 0]])
    // after the pan the match sits at y 100..140, inside the panel → no scroll
    expect(panel.shifts).toEqual([])

    const graph2 = scroller(box(0, 0, 1000, 720))
    const panel2 = scroller(box(0, 0, 1000, 300))
    revealRect(box(1500, 900, 1600, 940), [graph2.s, panel2.s])
    expect(graph2.shifts).toEqual([[1050, 560]])
    // the match is now at the graph's centre (y 340..380), below the 300px panel
    expect(panel2.shifts).toEqual([[0, 210]])
  })
})
