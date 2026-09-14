import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Takes the screen for an element, and tells you when it lets go.
 *
 * A macro is a strip of someone's document, which is no place to draw: the block is as wide as the
 * prose and a few hundred pixels tall. The Fullscreen API is the only way an iframe can have more
 * than its box — the host delegates it with `allow="fullscreen"` on the frame — and it keeps the
 * user in charge, because the browser requires a gesture to enter and always honours Escape to leave.
 *
 * Escape is why this reports state rather than just offering the two calls: the user can leave
 * fullscreen without touching anything of ours, and the block has to notice and come back out of edit
 * mode with them. Watching `fullscreenchange` is what makes the browser's own exit and our Cancel
 * button do the same thing.
 *
 * Fullscreen can also simply be refused — an iframe without the delegation, a browser that does not
 * do it, a user who has denied it. `enter` resolves either way and `isFullscreen` stays false; the
 * editor then opens in the block as it otherwise would, which is smaller but not broken.
 */
export function useFullscreen<T extends HTMLElement = HTMLElement>() {
  const ref = useRef<T>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const sync = () => setIsFullscreen(document.fullscreenElement === ref.current)
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  const enter = useCallback(async () => {
    const element = ref.current
    if (!element?.requestFullscreen || document.fullscreenElement) return
    try {
      await element.requestFullscreen()
    } catch {
      // Refused, so the editor stays in the block. Nothing to tell the user: they asked to draw, and
      // they can.
    }
  }, [])

  const exit = useCallback(async () => {
    if (document.fullscreenElement !== ref.current) return
    try {
      await document.exitFullscreen()
    } catch {
      // Already gone.
    }
  }, [])

  return { ref, isFullscreen, enter, exit }
}
