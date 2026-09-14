/** The worker, as a promise-shaped thing a component can await. */
import { useCallback, useEffect, useMemo, useRef } from 'react'

import type { SearchResult } from './engine'
import type { Profile } from './levels'

type Pending = {
  resolve: (result: SearchResult) => void
  reject: (error: Error) => void
}

export type Engine = {
  think: (fen: string, profile: Profile) => Promise<SearchResult>
}

export function useEngine(): Engine {
  const worker = useRef<Worker | undefined>(undefined)
  const pending = useRef(new Map<number, Pending>())
  const nextId = useRef(0)

  // Started on first use, not on mount: most screens showing a board never ask it anything, and a
  // worker per mounted board is a thread per dashboard widget.
  const ensure = useCallback(() => {
    if (worker.current) return worker.current
    const created = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' })
    created.onmessage = (event: MessageEvent<{ id: number; error?: string } & SearchResult>) => {
      const { id, error, ...result } = event.data
      const waiting = pending.current.get(id)
      if (!waiting) return
      pending.current.delete(id)
      if (error) waiting.reject(new Error(error))
      else waiting.resolve(result)
    }
    created.onerror = () => {
      for (const waiting of pending.current.values()) {
        waiting.reject(new Error('The chess engine failed to start.'))
      }
      pending.current.clear()
    }
    worker.current = created
    return created
  }, [])

  useEffect(
    () => () => {
      worker.current?.terminate()
      worker.current = undefined
      pending.current.clear()
    },
    [],
  )

  const think = useCallback<Engine['think']>(
    (fen, profile) =>
      new Promise<SearchResult>((resolve, reject) => {
        const id = nextId.current++
        pending.current.set(id, { resolve, reject })
        ensure().postMessage({ id, fen, profile })
      }),
    [ensure],
  )

  // Memoised: an effect that depends on the engine would otherwise re-run on every render, and
  // cancel the very search it had just started.
  return useMemo(() => ({ think }), [think])
}
