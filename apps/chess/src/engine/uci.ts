/**
 * Stockfish, spoken to in UCI.
 *
 * The engine is a real worker file on the app's own origin (`public/engine/`, put there by
 * `scripts/copy-engine.mjs`) for two independent reasons: the bundle CSP has no `worker-src`, so it
 * falls back to `script-src 'self'` and a `blob:` worker is blocked with no error at all; and the
 * Emscripten glue finds its own `.wasm` beside itself at runtime, which only works if the two files
 * really are neighbours on the origin.
 *
 * Compiling that `.wasm` needs `'wasm-unsafe-eval'` in the bundle policy. Without it every search
 * fails at boot — the worker errors and `think()` rejects, which the caller treats as a move not
 * made rather than as a broken game.
 *
 * **One search at a time.** UCI is a conversation with a single engine process: a second `go` before
 * the first `bestmove` is not a second search, it is a corrupted one. Requests therefore queue, which
 * is also exactly what analysis wants — it walks a game one position at a time and counts progress.
 */
import { Chess } from 'chess.js'

import { MATE_SCORE } from '../chess/analysis'
import type { Profile } from './levels'
import { type Candidate, pickByLoss } from './weaken'

/**
 * The build served from `public/engine/`.
 *
 * Kept in step with `scripts/copy-engine.mjs`, which refuses to run if the two disagree — a copied
 * file under a name nothing loads is a blank board with nothing in the console to explain it.
 */
export const ENGINE_BASENAME = 'stockfish-18-lite-single'

export type SearchResult = {
  /** The chosen move in UCI, or undefined when the position has no legal move. */
  uci?: string
  /** Centipawns from the mover's point of view. */
  score: number
  /** The deepest ply the search reported. */
  depth: number
}

export type Engine = {
  search: (fen: string, profile: Profile) => Promise<SearchResult>
  terminate: () => void
}

/** Once a search is this far past its own budget, ask it to stop. */
const STOP_GRACE_MS = 2000

/** And if `stop` produces no `bestmove` either, the engine is gone. */
const HARD_GRACE_MS = 5000

/**
 * A mate, on the scale `src/chess/analysis.ts` reads.
 *
 * UCI counts mate in *moves*; the stored scale counts plies below [MATE_SCORE], which is what
 * `mateIn()` inverts. A mate in N is 2N−1 plies away, so that is what gets subtracted — and a mate
 * the mover is *receiving* stays negative, exactly as Stockfish reports it.
 */
function mateScore(movesToMate: number): number {
  const plies = Math.max(1, 2 * Math.abs(movesToMate) - 1)
  const magnitude = MATE_SCORE - plies
  return movesToMate < 0 ? -magnitude : magnitude
}

type Line = Candidate & { depth: number; multipv: number }

/**
 * One `info` line, or undefined when it carries no usable score.
 *
 * Tokenised rather than matched with a regex because UCI puts its fields in no fixed order and only
 * `pv` is positional — everything after it is the line itself, so reading stops there.
 */
export function parseInfo(line: string): Line | undefined {
  // A bounded score is a search artefact, not an evaluation: ranking moves by one compares a real
  // value against a limit and calls the difference a blunder.
  if (line.includes(' lowerbound') || line.includes(' upperbound')) return undefined

  const tokens = line.split(/\s+/)
  let depth = 0
  let multipv = 1
  let score: number | undefined
  let uci: string | undefined

  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]
    if (token === 'depth') depth = Number(tokens[index + 1])
    else if (token === 'multipv') multipv = Number(tokens[index + 1])
    else if (token === 'score') {
      const kind = tokens[index + 1]
      const value = Number(tokens[index + 2])
      if (kind === 'cp') score = value
      else if (kind === 'mate') score = mateScore(value)
    } else if (token === 'pv') {
      uci = tokens[index + 1]
      break
    }
  }

  if (score === undefined || !uci || !Number.isFinite(depth)) return undefined
  return { uci, score, depth, multipv }
}

type Request = {
  fen: string
  profile: Profile
  resolve: (result: SearchResult) => void
  reject: (error: Error) => void
}

type Waiter = {
  matches: (line: string) => boolean
  resolve: (line: string) => void
  reject: (error: Error) => void
}

/** Start the engine. Nothing is loaded until the first search, which is when `boot()` runs. */
export function createEngine(
  spawn: () => Worker = () => new Worker(new URL(`engine/${ENGINE_BASENAME}.js`, document.baseURI)),
): Engine {
  const worker = spawn()
  const waiters = new Set<Waiter>()
  const queue: Request[] = []
  /** Indexed by `multipv`, so a deeper iteration replaces a shallower one in place. */
  let lines = new Map<number, Line>()
  let active: Request | undefined
  let booted: Promise<void> | undefined
  let multiPv = 0
  let dead: Error | undefined

  const send = (command: string) => worker.postMessage(command)

  function fail(error: Error): void {
    dead ??= error
    for (const waiter of [...waiters]) {
      waiters.delete(waiter)
      waiter.reject(error)
    }
    const abandoned = [active, ...queue.splice(0)].filter((request): request is Request =>
      Boolean(request),
    )
    active = undefined
    for (const request of abandoned) request.reject(error)
  }

  worker.onmessage = (event: MessageEvent<unknown>) => {
    const line = typeof event.data === 'string' ? event.data : String(event.data ?? '')

    if (active && line.startsWith('info ')) {
      const parsed = parseInfo(line)
      // Only ever forward, so a `stop` mid-iteration cannot replace a finished depth with a partial
      // one — the shallower line arrives later but describes less.
      if (parsed && parsed.depth >= (lines.get(parsed.multipv)?.depth ?? 0)) {
        lines.set(parsed.multipv, parsed)
      }
    }

    for (const waiter of [...waiters]) {
      if (!waiter.matches(line)) continue
      waiters.delete(waiter)
      waiter.resolve(line)
    }
  }

  worker.onerror = () => fail(new Error('The chess engine failed to start.'))

  function expect(matches: (line: string) => boolean): Promise<string> {
    if (dead) return Promise.reject(dead)
    return new Promise<string>((resolve, reject) => waiters.add({ matches, resolve, reject }))
  }

  /**
   * `uci` then `isready`, once per engine.
   *
   * Deferred to the first search rather than done on construction: most screens that mount a board
   * never ask it anything, and 7MB of WebAssembly per mounted board is a dashboard that stutters.
   */
  function boot(): Promise<void> {
    booted ??= (async () => {
      send('uci')
      await expect((line) => line.trim() === 'uciok')
      send('isready')
      await expect((line) => line.trim() === 'readyok')
    })()
    return booted
  }

  /** Wait for `bestmove`, nudging a search that overruns and giving up on one that is gone. */
  function awaitBestmove(budgetMs: number): Promise<string> {
    const answer = expect((line) => line.startsWith('bestmove'))
    return new Promise<string>((resolve, reject) => {
      let hard: ReturnType<typeof setTimeout> | undefined
      const soft = setTimeout(() => {
        send('stop')
        hard = setTimeout(
          () => fail(new Error('The chess engine stopped responding.')),
          HARD_GRACE_MS,
        )
      }, budgetMs + STOP_GRACE_MS)

      const settle = () => {
        clearTimeout(soft)
        if (hard) clearTimeout(hard)
      }
      answer.then(
        (line) => {
          settle()
          resolve(line)
        },
        (error: Error) => {
          settle()
          reject(error)
        },
      )
    })
  }

  function finish(request: Request, bestmove: string): SearchResult {
    const move = bestmove.split(/\s+/)[1]
    if (!move || move === '(none)') {
      // A game's last position is a terminal one, and scoring it 0 made a checkmate read as dead
      // level — so the mating move showed up in a review as the worst blunder in the game.
      return { score: new Chess(request.fen).isCheckmate() ? -MATE_SCORE : 0, depth: 0 }
    }

    const ranked = [...lines.values()].sort((a, b) => b.score - a.score)
    const depth = ranked[0]?.depth ?? 0
    if (ranked.length === 0) return { uci: move, score: 0, depth }

    // A level that always plays its best plays the engine's own answer. Its score is the position's
    // evaluation, which is what analysis stores.
    if (request.profile.meanLoss <= 0) {
      const played = ranked.find((candidate) => candidate.uci === move) ?? ranked[0]
      return { uci: move, score: played.score, depth }
    }

    const chosen = pickByLoss(ranked, request.profile.meanLoss, request.profile.maxLoss)
    return { uci: chosen.uci, score: chosen.score, depth }
  }

  async function run(request: Request): Promise<SearchResult> {
    await boot()
    const { profile } = request

    const wanted = Math.max(1, profile.multiPv)
    if (wanted !== multiPv) {
      send(`setoption name MultiPV value ${wanted}`)
      multiPv = wanted
    }

    lines = new Map()
    send(`position fen ${request.fen}`)
    send(`go depth ${profile.depth} movetime ${profile.timeMs}`)
    return finish(request, await awaitBestmove(profile.timeMs))
  }

  function pump(): void {
    if (active || dead || queue.length === 0) return
    const request = queue.shift() as Request
    active = request
    run(request).then(
      (result) => {
        active = undefined
        request.resolve(result)
        pump()
      },
      (error: Error) => {
        active = undefined
        request.reject(error)
        pump()
      },
    )
  }

  return {
    search(fen, profile) {
      if (dead) return Promise.reject(dead)
      return new Promise<SearchResult>((resolve, reject) => {
        queue.push({ fen, profile, resolve, reject })
        pump()
      })
    },
    terminate() {
      fail(new Error('The chess engine was stopped.'))
      worker.terminate()
    },
  }
}
