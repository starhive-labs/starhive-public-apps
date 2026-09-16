import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * search-manager indexes new objects asynchronously, so a list refetched immediately after a write
 * won't include the just-created entry yet. Wait a few seconds before bumping the remount key.
 */
export const INDEX_DELAY_MS = 2000

/**
 * Returns a remount `key` for a list, a `pending` flag (true while waiting), and a `reload` callback
 * to call after a write — it refetches after [delayMs] to give search-manager time to index.
 */
export function useReloadAfterIndex(delayMs: number = INDEX_DELAY_MS): {
  key: number
  pending: boolean
  reload: () => void
} {
  const [key, setKey] = useState(0)
  const [pending, setPending] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const reload = useCallback(() => {
    setPending(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      setKey((current) => current + 1)
      setPending(false)
    }, delayMs)
  }, [delayMs])

  useEffect(() => () => clearTimeout(timer.current), [])

  return { key, pending, reload }
}
