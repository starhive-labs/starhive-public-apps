/**
 * The engine, off the main thread.
 *
 * A real worker file, never an inlined `blob:` one: the bundle CSP has no `worker-src`, so it falls
 * back to `script-src 'self'` and a blob worker is blocked with no error at all. `vite.config.ts`
 * keeps workers as emitted files for exactly this reason.
 */
import { search } from './engine'
import type { Profile } from './levels'

export type EngineRequest = { id: number; fen: string; profile: Profile }

self.onmessage = (event: MessageEvent<EngineRequest>) => {
  const { id, fen, profile } = event.data
  try {
    self.postMessage({ id, ...search(fen, profile) })
  } catch (failure) {
    self.postMessage({ id, error: (failure as Error).message })
  }
}
