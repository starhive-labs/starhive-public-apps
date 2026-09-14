/**
 * Reading and writing a game.
 *
 * The one thing to know: **a game is read with `objects.get`, never with a query.** `objects.get`
 * goes straight to space-manager and is strongly consistent, while `objects.query` goes through the
 * search index and lags a couple of seconds — which for a board means watching your opponent's move
 * arrive late. Queries are for lists, where that is invisible.
 *
 * There is no push in the app platform, so seeing a move means polling. That is what `usePoll` is.
 */
import {
  type BridgeType,
  useBridge,
  useObject,
  useStarhiveContext,
  useType,
} from '@starhive/bridge'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  type AttrIds,
  attrIds,
  applyMove,
  type Game,
  isActive,
  isComputerTurn,
  isWaitingForOpponent,
  turnOf,
  type Move,
  type Opponent,
  readGame,
  START_FEN,
  STATE,
  type Seat,
  TYPE_KEY,
} from './chess/game'
import { DEFAULT_LEVEL, profileFor } from './engine/levels'
import { clockAfterMove, controlFor, pollMsFor, WAITING_POLL_MS } from './chess/timeControl'
import { useEngine } from './engine/useEngine'

/** How often a live game re-reads itself. Slow enough to be polite, fast enough to feel live. */
export const POLL_MS = 3000

/**
 * Call [refetch] on an interval while [active], and immediately whenever this window comes back.
 *
 * The interval alone is not enough, and this is the bug that made a game look like it never started.
 * Browsers throttle `setInterval` hard in a window that is not in front — Chrome drops it to roughly
 * once a minute — so the player who created a game and then looked at another window carried on
 * "waiting for an opponent" long after somebody had taken the seat. The opponent's screen was fine,
 * because theirs was the window in front.
 *
 * So there are three triggers, not one: the interval, becoming visible again, and regaining focus.
 * The last is the one that matters here, because a window merely behind another is often never
 * `hidden` — it is just throttled, and no visibility event ever fires.
 */
export function usePoll(refetch: () => void, active: boolean, intervalMs = POLL_MS): void {
  // Kept in a ref so a new `refetch` identity each render does not restart the interval.
  const latest = useRef(refetch)
  latest.current = refetch

  useEffect(() => {
    if (!active) return
    let timer: ReturnType<typeof setInterval> | undefined

    const start = () => {
      if (timer) return
      timer = setInterval(() => latest.current(), intervalMs)
    }
    const stop = () => {
      clearInterval(timer)
      timer = undefined
    }
    const onVisibility = () => {
      if (document.hidden) {
        // A background board does not need a heartbeat, and every app on the dashboard polling
        // forever is how a workspace gets slow.
        stop()
      } else {
        latest.current()
        start()
      }
    }
    // Coming back to the window is the moment the answer is wanted, whether or not the browser ever
    // called the page hidden.
    const onFocus = () => latest.current()

    if (!document.hidden) start()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onFocus)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onFocus)
    }
  }, [active, intervalMs])
}

export type GameType = {
  type: BridgeType | undefined
  ids: AttrIds | undefined
  isLoading: boolean
  error: Error | null
  /** True when the type resolved but an attribute the app needs is not on it. */
  incomplete: boolean
}

/** The provisioned type and every attribute id, resolved once. */
export function useGameType(): GameType {
  const { data: type, isLoading, error } = useType(TYPE_KEY)
  const ids = useMemo(() => (type ? attrIds(type) : undefined), [type])
  return { type, ids, isLoading, error, incomplete: Boolean(type) && !ids }
}

export type UseGameResult = {
  game: Game | undefined
  ids: AttrIds | undefined
  /**
   * True only until there is a game to show.
   *
   * Same rule as `useGames`: a board polls every couple of seconds, and the underlying hook raises
   * its own `isLoading` on each of those while keeping the game it already has. Passing that through
   * would leave every caller one forgotten guard away from flashing "Loading…" over a live board.
   */
  isLoading: boolean
  /** A re-read over a game already on screen. */
  isRefreshing: boolean
  error: Error | null
  refetch: () => void
}

/** One game, kept current by polling while it is still being played. */
export function useGame(gameId: string | undefined): UseGameResult {
  const { stateKeyToId } = useStarhiveContext()
  const { ids, isLoading: typeLoading, error: typeError } = useGameType()
  const { data, isLoading, error, refetch } = useObject(gameId)

  const game = useMemo(
    () => (data && ids ? readGame(data, ids, stateKeyToId) : undefined),
    [data, ids, stateKeyToId],
  )
  // A finished or cancelled game will never change again, so it stops polling. A fast one polls
  // faster, and a daily game must not cost a request every three seconds for a week.
  usePoll(
    refetch,
    Boolean(gameId) && Boolean(game) && isActive(game!),
    game && isWaitingForOpponent(game)
      ? WAITING_POLL_MS
      : pollMsFor(controlFor(game?.timeControl)),
  )

  const busy = isLoading || typeLoading
  return {
    game,
    ids,
    isLoading: busy && !game,
    isRefreshing: busy && Boolean(game),
    error: error ?? typeError,
    refetch,
  }
}

export type NewGame = {
  title: string
  /** The seat the creator takes. The other is the opponent's. */
  seat: Seat
  opponent: Opponent
  /** The rating a computer opponent plays at. Ignored for a human game. */
  level?: number
  /** A time control key, for a game against a person. Computer games are untimed. */
  timeControl?: string
}

export type GameActions = {
  /** Create a game. Resolves to the new game's id. */
  create: (game: NewGame) => Promise<string>
  /** Take the empty seat. */
  claim: (game: Game) => Promise<void>
  /** Play a move. Rejects when it is not legal, or not yours to make. */
  play: (game: Game, move: Move) => Promise<void>
  /** Concede. */
  resign: (game: Game) => Promise<void>
  /** Call off a challenge nobody took. */
  cancel: (game: Game) => Promise<void>
  /** End a game on time, against [loser]. */
  flag: (game: Game, loser: Seat) => Promise<void>
  /** Read one game straight from space-manager, bypassing the search index. */
  read: (gameId: string) => Promise<Game | undefined>
  /** Store a finished game's analysis, so nobody has to compute it again. */
  saveAnalysis: (game: Game, evals: string, engine: string) => Promise<void>
}

/**
 * Every write this app makes.
 *
 * A `WORKFLOW` value cannot simply be written — Starhive refuses a state that does not name the
 * transition that reached it — so the moves are asked for per object and matched **on their target
 * state id**, never on a name an admin can rename.
 */
export function useGameActions(): GameActions {
  const bridge = useBridge()
  const { user, stateKeyToId } = useStarhiveContext()
  const { ids } = useGameType()

  /**
   * Move the status to [stateKey], if this install can.
   *
   * **Its own write, always, and never allowed to throw.** The status used to ride along in the same
   * `objects.update` as the thing that actually mattered — the seat being taken, the move being
   * played — so a transition space-manager refused took the whole write down with it. Pressing
   * "Play as Black" and watching nothing happen is what that looks like from the outside: the seat
   * was never written, because a badge could not be moved.
   *
   * A workflow is provisioned once and never updated (see the README), so a state this manifest
   * declares may not exist here at all, and a transition that does exist may be refused for reasons
   * this app cannot see. Neither is a reason to refuse somebody a game.
   */
  const moveStatus = useCallback(
    async (gameId: string, stateKey: string): Promise<void> => {
      if (!ids) return
      const target = stateKeyToId[stateKey]
      if (!target) return
      try {
        const { transitions } = await bridge.workflow.transitions(gameId, ids.status)
        const transition = transitions.find((candidate) => candidate.toStateId === target)
        if (!transition) return
        await bridge.objects.update(gameId, [{ attributeId: ids.status, values: [target] }], {
          transitions: { [ids.status]: transition.id },
        })
      } catch {
        // A status badge is not worth failing a join, a move or a resignation over.
      }
    },
    [bridge, ids, stateKeyToId],
  )

  const create = useCallback<GameActions['create']>(
    async ({ title, seat, opponent, level, timeControl }) => {
      if (!ids) throw new Error('The Chess app is not fully provisioned yet.')
      const control = opponent === 'human' ? controlFor(timeControl) : undefined
      const created = await bridge.objects.create(TYPE_KEY, [
        { attributeId: ids.title, values: [title] },
        { attributeId: seat === 'w' ? ids.white : ids.black, values: [user.id] },
        { attributeId: ids.fen, values: [START_FEN] },
        { attributeId: ids.result, values: ['*'] },
        { attributeId: ids.opponent, values: [opponent === 'computer' ? 'Computer' : 'Human'] },
        ...(opponent === 'computer'
          ? [{ attributeId: ids.level, values: [String(level ?? DEFAULT_LEVEL)] }]
          : []),
        // Both clocks are set now and neither starts: nothing ticks until somebody takes the other
        // seat, or the creator would flag while waiting for an opponent who never came.
        ...(control
          ? [
              { attributeId: ids.timeControl, values: [control.key] },
              { attributeId: ids.whiteMs, values: [String(control.initialMs)] },
              { attributeId: ids.blackMs, values: [String(control.initialMs)] },
            ]
          : []),
      ])

      // A computer game is under way the moment it exists — nobody is coming, so it must not sit in
      // the lobby as an open challenge. A human game stays open until someone takes the seat.
      if (opponent === 'computer') await moveStatus(created.id, STATE.playing)
      return created.id
    },
    [bridge, ids, moveStatus, user.id],
  )

  const cancel = useCallback<GameActions['cancel']>(
    async (game) => {
      if (!ids) throw new Error('The Chess app is not fully provisioned yet.')
      // The attribute is the cancellation; the workflow state is only a mirror of it.
      await bridge.objects.update(game.id, [{ attributeId: ids.cancelled, values: ['true'] }])
      await moveStatus(game.id, STATE.cancelled)
    },
    [bridge, ids, moveStatus],
  )

  const claim = useCallback<GameActions['claim']>(
    async (game) => {
      if (!ids) throw new Error('The Chess app is not fully provisioned yet.')
      const seat = game.white ? 'b' : 'w'
      const me = user.name ?? 'Someone'
      // Now that both seats are filled the game can be named after the people in it, which is what
      // a lobby row wants to say. Nobody typed this, and nobody should have to.
      const title =
        seat === 'b' ? `${game.white?.name ?? '?'} vs ${me}` : `${me} vs ${game.black?.name ?? '?'}`

      // Taking the seat is the write that matters, so it goes alone — nothing decorative can stop it
      // landing.
      await bridge.objects.update(game.id, [
        { attributeId: seat === 'w' ? ids.white : ids.black, values: [user.id] },
        { attributeId: ids.title, values: [title] },
        // The clock starts here, on the seat being taken — this is the moment the game begins.
        ...(game.timeControl
          ? [{ attributeId: ids.turnStartedAt, values: [String(Date.now())] }]
          : []),
      ])
      await moveStatus(game.id, STATE.playing)
    },
    [bridge, ids, moveStatus, user.id],
  )

  const play = useCallback<GameActions['play']>(
    async (game, move) => {
      if (!ids) throw new Error('The Chess app is not fully provisioned yet.')
      const outcome = applyMove(game, move)
      if (!outcome) throw new Error('That move is not legal.')

      const finishing = outcome.result !== '*'

      // The mover's clock: what they had, less what they took, plus the increment. Only the mover's
      // changes, which is why one write a move is enough.
      const control = controlFor(game.timeControl)
      const now = Date.now()
      const mover = turnOf(game)
      const clock = control
        ? [
            {
              attributeId: mover === 'w' ? ids.whiteMs : ids.blackMs,
              values: [
                String(
                  Math.round(
                    clockAfterMove(
                      (mover === 'w' ? game.whiteMs : game.blackMs) ?? control.initialMs,
                      game.turnStartedAt,
                      now,
                      control,
                    ),
                  ),
                ),
              ],
            },
            { attributeId: ids.turnStartedAt, values: [String(now)] },
          ]
        : []

      await bridge.objects.update(
        game.id,
        [
          { attributeId: ids.fen, values: [outcome.fen] },
          { attributeId: ids.moves, values: [outcome.moves.join(' ')] },
          { attributeId: ids.result, values: [outcome.result] },
          ...clock,
        ],
      )
      // The game ending is the only move that also moves the workflow, and it does so afterwards:
      // the move is already recorded, whatever the status does.
      if (finishing) await moveStatus(game.id, STATE.finished)
    },
    [bridge, ids, moveStatus],
  )

  /** End a game with [result], moving the status alongside it when this install has the state. */
  const finish = useCallback(
    async (game: Game, result: '1-0' | '0-1') => {
      if (!ids) throw new Error('The Chess app is not fully provisioned yet.')
      await bridge.objects.update(game.id, [{ attributeId: ids.result, values: [result] }])
      await moveStatus(game.id, STATE.finished)
    },
    [bridge, ids, moveStatus],
  )

  const resign = useCallback<GameActions['resign']>(
    (game) => finish(game, game.white?.id === user.id ? '0-1' : '1-0'),
    [finish, user.id],
  )

  const flag = useCallback<GameActions['flag']>(
    (game, loser) => finish(game, loser === 'w' ? '0-1' : '1-0'),
    [finish],
  )

  const read = useCallback<GameActions['read']>(
    async (gameId) => {
      if (!ids) return undefined
      return readGame(await bridge.objects.get(gameId), ids, stateKeyToId)
    },
    [bridge, ids, stateKeyToId],
  )

  const saveAnalysis = useCallback<GameActions['saveAnalysis']>(
    async (game, evals, engine) => {
      if (!ids) throw new Error('The Chess app is not fully provisioned yet.')
      await bridge.objects.update(game.id, [
        { attributeId: ids.evals, values: [evals] },
        { attributeId: ids.analysisEngine, values: [engine] },
      ])
    },
    [bridge, ids],
  )

  // Memoised: `useComputerOpponent` depends on `play`, and a fresh object every render would
  // restart its effect every render.
  return useMemo(
    () => ({ create, claim, play, resign, cancel, flag, read, saveAnalysis }),
    [create, claim, play, resign, cancel, flag, read, saveAnalysis],
  )
}

/**
 * Plays the computer's moves.
 *
 * There is no server, so "the computer" is a worker in whichever player's browser has the game open.
 * That sounds fragile and is not: the trigger is the position itself, so a game left with the
 * computer to move simply gets its reply the next time anyone opens it.
 *
 * The guard is keyed on how many moves have been played, not on a boolean, because the poll hands
 * this effect a new `game` object every few seconds and a boolean would let it move twice.
 */
export function useComputerOpponent(
  game: Game | undefined,
  refetch: () => void,
): { thinking: boolean } {
  const { play } = useGameActions()
  const engine = useEngine()
  const [thinking, setThinking] = useState(false)
  const playedFor = useRef<string | undefined>(undefined)

  const running = useRef(false)

  useEffect(() => {
    if (!game || !isComputerTurn(game)) {
      // A game that is no longer the computer's to move must not be left saying it is thinking.
      if (!running.current) setThinking(false)
      return
    }
    const position = `${game.id}:${game.moves.length}`
    if (playedFor.current === position || running.current) return

    // Deliberately *not* cancelled by this effect's cleanup. The poll hands us a new `game` object
    // every few seconds and `setThinking` re-renders immediately, so a search tied to the effect's
    // lifetime is abandoned before it finishes — which is exactly how the engine ended up thinking
    // forever and never moving. A search, once started, always runs to its end and plays its move.
    playedFor.current = position
    running.current = true
    setThinking(true)

    const snapshot = game
    engine
      .think(snapshot.fen, profileFor(snapshot.level ?? DEFAULT_LEVEL))
      .then((result) => {
        if (!result.uci) return undefined
        return play(snapshot, {
          from: result.uci.slice(0, 2),
          to: result.uci.slice(2, 4),
          promotion: result.uci.slice(4, 5) || undefined,
        })
      })
      .then(() => refetch())
      .catch(() => {
        // Let the next poll try again rather than leaving the game stuck on a transient failure.
        playedFor.current = undefined
      })
      .finally(() => {
        running.current = false
        setThinking(false)
      })
  }, [engine, game, play, refetch])

  return { thinking }
}
