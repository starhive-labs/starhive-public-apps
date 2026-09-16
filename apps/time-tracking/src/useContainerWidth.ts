import { type RefObject, useLayoutEffect, useRef, useState } from 'react'

/**
 * The rendered width of an element, kept current as it resizes.
 *
 * For layouts that depend on the room actually available rather than on the viewport. An app frame
 * has no useful viewport of its own: the same component is a full-width page in one slot and a
 * ~260px column in an object's detail panel in another, and a media query would see the same window
 * either way. Measuring the container is the only thing that tells them apart.
 *
 * Measured in a layout effect, before the browser paints, so a component that switches layout on the
 * result does not flash the wrong one first. Width is `0` until the first measurement.
 */
export function useContainerWidth<T extends HTMLElement = HTMLDivElement>(): [
  RefObject<T | null>,
  number,
] {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return

    // Only a real change is reported: a ResizeObserver fires on sub-pixel reflows too, and setting
    // state on each would re-render for a width that did not change.
    const report = () =>
      setWidth((current) => {
        const next = Math.round(element.getBoundingClientRect().width)
        return next === current ? current : next
      })

    report()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(report)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return [ref, width]
}
