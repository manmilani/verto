import { useCallback, useRef } from 'react'

/** Pans a region's content by −(dx, dy) on screen. */
export type Pan = (dx: number, dy: number) => void

const regions = new WeakMap<Element, Pan>()

/** Elements whose content moves by panning (not scrolling); find reveals matches in them by panning. */
export function panRegionOf(el: Element): Pan | undefined {
  return regions.get(el)
}

/** Callback ref registering the element it is attached to as a pan region. */
export function usePanRegion(pan: Pan): (el: HTMLElement | null) => void {
  const panRef = useRef(pan)
  panRef.current = pan
  const current = useRef<HTMLElement | null>(null)
  return useCallback((el: HTMLElement | null) => {
    if (current.current) regions.delete(current.current)
    current.current = el
    if (el) regions.set(el, (dx, dy) => panRef.current(dx, dy))
  }, [])
}
