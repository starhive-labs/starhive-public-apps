/** The engine, as a promise-shaped thing a component can await. */
import { useCallback, useEffect, useMemo, useRef } from 'react'

import type { Profile } from './levels'
import { createEngine, type Engine as UciEngine, type SearchResult } from './uci'

export type Engine = {
  think: (fen: string, profile: Profile) => Promise<SearchResult>
}

export function useEngine(): Engine {
  const engine = useRef<UciEngine | undefined>(undefined)

  // Started on first use, not on mount: most screens showing a board never ask it anything, and
  // 7MB of WebAssembly per mounted board is a thread and a download per dashboard widget.
  const ensure = useCallback(() => {
    engine.current ??= createEngine()
    return engine.current
  }, [])

  useEffect(
    () => () => {
      engine.current?.terminate()
      engine.current = undefined
    },
    [],
  )

  // Requests are serialised inside the engine — UCI is one conversation, and a second `go` before
  // the first `bestmove` is not a second search but a corrupted one. Callers just await.
  const think = useCallback<Engine['think']>(
    (fen, profile) =>
      ensure()
        .search(fen, profile)
        .catch((failure: Error) => {
          // Every rejection from the engine is a fatal one — a worker that failed to start, or a
          // search that stopped answering — and none of them mend themselves. Drop the instance so
          // the next attempt boots a fresh engine instead of rejecting for the rest of the page's
          // life: a game whose opponent stops moving until someone reloads is the worse failure.
          engine.current?.terminate()
          engine.current = undefined
          throw failure
        }),
    [ensure],
  )

  // Memoised: an effect that depends on the engine would otherwise re-run on every render, and
  // cancel the very search it had just started.
  return useMemo(() => ({ think }), [think])
}
