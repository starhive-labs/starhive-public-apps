/**
 * The board: one game, drawn and played.
 *
 * Shared by every slot — the global page, the object panel, the macro — because a board is a board.
 * What differs between slots is how much room it is given (`maxBoard`) and what surrounds it.
 */
import { useStarhiveContext, useTheme, useToast } from '@starhive/bridge'
import { Badge, Button, Card } from '@starhive/ui'
import { Anchor, Group, Stack, Text } from '@mantine/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Chessboard } from 'react-chessboard'

import {
  applyMove,
  isCancelled,
  isMyTurn,
  isActive,
  isOver,
  isWaitingForOpponent,
  type Move,
  moveHighlights,
  type MoveOutcome,
  openSeat,
  opponentOf,
  outcomeText,
  resultHeadline,
  seatOf,
  turnOf,
  verifyHistory,
} from '../chess/game'
import { lichessAnalysisUrl, sanMoves, toPgn } from '../chess/pgn'
import { clockState, controlFor, tickMsFor } from '../chess/timeControl'
import { useComputerOpponent, useGame, useGameActions } from '../useGame'
import { Clock } from './Clock'
import { boardColours } from '../chess/boardTheme'
import { WaitingForOpponent } from './WaitingForOpponent'
import { boardLayout, GAP, PANEL } from './boardLayout'
import { GameReview } from './GameReview'
import { MoveList } from './MoveList'

/**
 * The last-move wash.
 *
 * One hue at two strengths rather than two colours: the eye reads "recent, and a little less recent"
 * without a legend. Translucent so it sits over a light and a dark square alike.
 */
const HIGHLIGHT = {
  latest: 'rgba(255, 199, 44, 0.55)',
  previous: 'rgba(255, 199, 44, 0.22)',
} as const

function useBoardSize(max: number): {
  ref: React.RefObject<HTMLDivElement | null>
  size: number
  sideBySide: boolean
} {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [viewport, setViewport] = useState(() =>
    typeof window === 'undefined' ? 800 : window.innerHeight,
  )

  useEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => entry && setWidth(entry.contentRect.width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const onResize = () => setViewport(window.innerHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const { size, sideBySide } = boardLayout(width, viewport, max)
  return { ref, size, sideBySide }
}

export function Board({
  gameId,
  maxBoard = 560,
  onExit,
  onCancelled,
}: {
  gameId: string | undefined
  /** The largest the board may be in this slot. A page can afford more than a macro block. */
  maxBoard?: number
  /** Called after the game is cancelled, so the caller can go back to wherever it came from. */
  onExit?: () => void
  /** Called with the id of a game that was just cancelled, before [onExit]. */
  onCancelled?: (gameId: string) => void
}) {
  const { user } = useStarhiveContext()
  const theme = useTheme()
  // The board takes the workspace's hue, at a lightness a chessboard actually works at.
  const squares = useMemo(() => boardColours(theme.colors.primary), [theme.colors.primary])
  const { game, isLoading, error, refetch } = useGame(gameId)
  const actions = useGameActions()
  const toast = useToast()
  const { ref: frameRef, size, sideBySide } = useBoardSize(maxBoard)
  // "The computer" is a worker in this browser. Nothing happens unless someone has the game open,
  // which is why a game left mid-think simply resumes when it is next opened.
  const { thinking } = useComputerOpponent(game, refetch)

  /**
   * The move just played, shown before the write comes back.
   *
   * Without it the piece snaps back to where it started and jumps forward a moment later, because
   * the board draws the server's FEN and the server has not heard yet.
   */
  const [pending, setPending] = useState<MoveOutcome | undefined>(undefined)

  // Drop it the moment the real game has caught up (or moved on without us).
  useEffect(() => {
    if (pending && game && game.moves.length >= pending.moves.length) setPending(undefined)
  }, [game, pending])

  const fen = pending?.fen ?? game?.fen
  const seat = game ? seatOf(game, user.id) : undefined
  const myTurn = Boolean(game && !pending && !thinking && isMyTurn(game, user.id))

  // Highlight what is on screen, which during an optimistic move is the move not yet written.
  const squareStyles = useMemo(() => {
    const shown = pending?.moves ?? game?.moves ?? []
    return Object.fromEntries(
      Object.entries(moveHighlights(shown)).map(([square, weight]) => [
        square,
        { backgroundColor: HIGHLIGHT[weight] },
      ]),
    )
  }, [game?.moves, pending?.moves])

  // Dismissing the result reveals the final position underneath. Reset per game, so opening another
  // finished game shows its result rather than inheriting this one's dismissal.
  const [resultSeen, setResultSeen] = useState<string | undefined>(undefined)
  const [reviewing, setReviewing] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  /**
   * What happened the last time somebody tried to take the seat.
   *
   * Shown in the card rather than only as a toast. A join that fails silently is impossible to
   * report and impossible to debug — this turns "nothing happened" into a sentence somebody can
   * read out.
   */
  const [joinReport, setJoinReport] = useState<string | undefined>(undefined)
  const [joining, setJoining] = useState(false)

  // A clock has to redraw between writes — nothing else changes while it counts down.
  const control = controlFor(game?.timeControl)
  const [, setTick] = useState(0)
  useEffect(() => {
    const ticking =
      control &&
      game &&
      isActive(game) &&
      !isWaitingForOpponent(game) &&
      game.turnStartedAt !== undefined
    if (!ticking) return
    const timer = setInterval(() => setTick((count) => count + 1), tickMsFor(control))
    return () => clearInterval(timer)
  }, [control, game])

  /**
   * The clocks as they read right now.
   *
   * Only runs once both seats are filled: a challenge waiting for an opponent must not tick down
   * while nobody is there to answer it.
   */
  const clocks =
    control && game
      ? clockState(
          { whiteMs: game.whiteMs ?? control.initialMs, blackMs: game.blackMs ?? control.initialMs },
          turnOf(game),
          game.turnStartedAt,
          Date.now(),
          isActive(game) && !isWaitingForOpponent(game) && game.turnStartedAt !== undefined,
        )
      : undefined

  /**
   * Somebody has to write the flag, because nothing here is watching but the players.
   *
   * Either side's client may do it and both may try; they would write the same result, and the last
   * one wins. A spectator never does — ending other people's games is not a bystander's job.
   */
  const flagged = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (!game || !clocks?.flagged || !isActive(game)) return
    if (!seatOf(game, user.id)) return
    if (flagged.current === game.id) return
    flagged.current = game.id
    actions
      .flag(game, clocks.flagged)
      .then(refetch)
      .catch(() => {
        flagged.current = undefined
      })
  }, [actions, clocks?.flagged, game, refetch, user.id])

  // Replaying the whole history is cheap, and it is the only thing standing between a tampered
  // position and a board that draws it as if it were real. See `verifyHistory`.
  const trustworthy = useMemo(() => (game ? verifyHistory(game) : true), [game])

  function onDrop(from: string, to: string): boolean {
    if (!game || !myTurn) return false
    // Phase 1 always promotes to a queen. Under-promotion needs the promotion dialog and is rare
    // enough to be worth leaving until someone asks for it.
    const move: Move = { from, to, promotion: 'q' }
    const outcome = applyMove(game, move)
    if (!outcome) return false

    setPending(outcome)
    actions
      .play(game, move)
      // Read straight back rather than waiting for the next poll: against the computer this is what
      // makes the reply feel immediate instead of arriving three seconds later.
      .then(refetch)
      .catch((failure: Error) => {
        setPending(undefined)
        refetch()
        void toast(failure.message, 'error')
      })
    return true
  }

  // The frame is measured even while the game loads, so the board does not resize under the player
  // the moment it arrives.
  return (
    <div ref={frameRef} style={{ width: '100%' }}>
      {/* `isLoading` is already only the first load — a poll does not re-raise it. */}
      {isLoading && <Text size="sm">Loading…</Text>}
      {error && (
        <Text size="sm" c="red">
          {error.message}
        </Text>
      )}
      {!isLoading && !game && !error && <Text size="sm">No game selected.</Text>}
      {game && fen && !trustworthy && (
        <Card>
          <Stack gap="xs">
            <Text fw={600}>This game does not add up</Text>
            <Text size="sm" c="dimmed">
              The stored position does not follow from the recorded moves, so the board is not drawn.
              Nothing validates a move on the server yet — see the app&apos;s README.
            </Text>
          </Stack>
        </Card>
      )}
      {game && fen && trustworthy && isWaitingForOpponent(game) && waiting()}
      {game && fen && trustworthy && reviewing && isOver(game) && (
        <GameReview
          game={game}
          maxBoard={maxBoard}
          onExit={() => setReviewing(false)}
          // The analysis was written to the object; re-read so the review keeps showing the saved
          // copy rather than the one held in this tab.
          onAnalysed={refetch}
        />
      )}
      {game &&
        fen &&
        trustworthy &&
        !isWaitingForOpponent(game) &&
        !(reviewing && isOver(game)) &&
        played()}
    </div>
  )

  /**
   * Take the empty seat, and say plainly what happened either way.
   *
   * The read-back is not only a race check. It is the difference between "the write was refused"
   * and "the write was accepted and the seat is still empty", which are different bugs and cannot be
   * told apart from the outside.
   */
  async function join() {
    if (!game) return
    setJoining(true)
    setJoinReport(undefined)
    try {
      await actions.claim(game)
      const after = await actions.read(game.id)
      if (!after) {
        setJoinReport('The seat was written, but the game could not be read back.')
        return
      }
      const mine = seatOf(after, user.id)
      if (!mine) {
        setJoinReport(
          `The write was accepted but no seat was taken. white=${after.white?.id ?? 'empty'}, ` +
            `black=${after.black?.id ?? 'empty'}, you=${user.id}`,
        )
        return
      }
      refetch()
    } catch (failure) {
      const error = failure as Error & { code?: string }
      setJoinReport(`${error.code ? `${error.code}: ` : ''}${error.message}`)
      void toast('Could not take the seat', 'error')
    } finally {
      setJoining(false)
    }
  }

  /** A challenge with one player in it — either yours to wait out, or somebody's to accept. */
  function waiting() {
    if (!game) return null
    const seat = seatOf(game, user.id)
    if (seat) {
      return (
        <Group justify="center">
          <WaitingForOpponent
            game={game}
            you={{ name: user.name, email: user.email, id: user.id }}
            yourSeat={seat}
            cancelling={cancelling}
            onCancel={() => {
              setCancelling(true)
              actions
                .cancel(game)
                .then(() => {
                  void toast('Game cancelled', 'info')
                  onCancelled?.(game.id)
                  if (onExit) onExit()
                  else refetch()
                })
                .catch((failure: Error) => toast(failure.message, 'error'))
                .finally(() => setCancelling(false))
            }}
          />
        </Group>
      )
    }

    const open = openSeat(game)
    return (
      <Group justify="center">
        <Card p="xl" style={{ maxWidth: 460, width: '100%' }}>
          <Stack gap="md" align="center">
            <Text fw={700} size="lg">
              {game.title}
            </Text>
            <Text size="sm" c="dimmed" ta="center">
              {game.white?.name ?? game.black?.name ?? 'Someone'} is waiting for an opponent. Take
              the {open === 'w' ? 'White' : 'Black'} seat and the game starts straight away.
            </Text>
            <Button disabled={joining} onClick={() => void join()}>
              {joining ? 'Taking the seat…' : `Play as ${open === 'w' ? 'White' : 'Black'}`}
            </Button>
            {joinReport && (
              <Text size="xs" c="red" ta="center" style={{ wordBreak: 'break-word' }}>
                {joinReport}
              </Text>
            )}
          </Stack>
        </Card>
      </Group>
    )
  }

  /**
   * The board and everything around it.
   *
   * A plain function, called as `played()`, *not* a component rendered as `<Played />`. Declared
   * inside `Board` it would be a different function — and so a different component type — on every
   * render, and React's answer to a changed type is to throw the subtree away and build a new one.
   * The chessboard remounting five times a second is what "the board blinks" was.
   */
  function played() {
    if (!game || !fen) return null
    const opponent = opponentOf(game, user.id)
    const moves = sanMoves(game)

    const board = (
      <Stack gap="sm" style={{ width: size, flexShrink: 0 }}>
        <Group justify="space-between" align="center" wrap="nowrap">
          <Text fw={600} truncate>
            {game.title}
          </Text>
          {status()}
        </Group>

        {clocks && (
          <Group justify="flex-end">
            <Clock
              ms={seat === 'b' ? clocks.whiteMs : clocks.blackMs}
              running={clocks.running === (seat === 'b' ? 'w' : 'b')}
            />
          </Group>
        )}

        {/* Positioned, so the result can sit in the middle of the board rather than the middle of
            the window — a modal over the page would cover the position it is reporting on. */}
        <div style={{ position: 'relative', width: size, height: size }}>
          <Chessboard
            position={fen}
            boardWidth={size}
            boardOrientation={seat === 'b' ? 'black' : 'white'}
            arePiecesDraggable={myTurn}
            onPieceDrop={onDrop}
            customSquareStyles={squareStyles}
            customLightSquareStyle={{ backgroundColor: squares.light }}
            customDarkSquareStyle={{ backgroundColor: squares.dark }}
          />
          {isOver(game) && resultSeen !== game.id && resultOverlay()}
        </div>

        {clocks && (
          <Group justify="flex-end">
            <Clock
              ms={seat === 'b' ? clocks.blackMs : clocks.whiteMs}
              running={clocks.running === (seat === 'b' ? 'b' : 'w')}
            />
          </Group>
        )}

        <Group gap="xs">
          {seat && !isOver(game) && !isCancelled(game) && opponent && (
            <Button
              variant="quiet"
              onClick={() =>
                actions
                  .resign(game)
                  .then(refetch)
                  .catch((failure: Error) => toast(failure.message, 'error'))
              }
            >
              Resign
            </Button>
          )}
          {isOver(game) && (
            <Button variant="secondary" onClick={() => setReviewing(true)}>
              Review game
            </Button>
          )}
          {moves.length > 0 && (
            <>
              <Button
                variant="quiet"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(toPgn(game))
                    .then(() => toast('PGN copied', 'success'))
                    .catch(() => toast('Could not copy the PGN', 'error'))
                }}
              >
                Copy PGN
              </Button>
              {/*
                A real link, not a fetch: `connect-src 'self'` blocks the request an app would make,
                but it does not block a navigation, and the sandbox grants `allow-popups`. Until this
                app analyses games itself, this is the analysis feature.
              */}
              <Anchor
                size="sm"
                href={lichessAnalysisUrl(game)}
                target="_blank"
                rel="noreferrer noopener"
              >
                Analyse on Lichess
              </Anchor>
            </>
          )}
        </Group>
      </Stack>
    )

    const side = (
      <Stack gap="sm" style={{ width: sideBySide ? PANEL : '100%', flexShrink: 0 }}>
        {isCancelled(game) && (
          <Card p="sm">
            <Text size="sm">This game was cancelled before anyone took the other seat.</Text>
          </Card>
        )}

        <MoveList moves={moves} height={Math.max(160, size - 60)} />
      </Stack>
    )

    return (
      <Group align="flex-start" justify="center" gap={GAP} wrap={sideBySide ? 'nowrap' : 'wrap'}>
        {board}
        {side}
      </Group>
    )
  }

  /** The result, over the board, the way a game ending is announced everywhere else. */
  function resultOverlay() {
    if (!game) return null
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          // Dark enough to lift the card off the board, light enough to keep the final position
          // readable behind it — the thing people want to look at as they read the result.
          background: 'rgba(0, 0, 0, 0.45)',
          borderRadius: 4,
        }}
      >
        <Card p="lg" style={{ minWidth: Math.min(260, size - 32), textAlign: 'center' }}>
          <Stack gap="xs" align="center">
            <Text fw={700} size="xl">
              {resultHeadline(game, user.id)}
            </Text>
            <Text size="sm" c="dimmed">
              {outcomeText(game)}
            </Text>
            <Text size="xs" c="dimmed">
              {game.white?.name ?? '?'} vs{' '}
              {game.black?.name ?? opponentOf(game, user.id)?.name ?? '?'}
            </Text>
            <Group gap="xs" justify="center">
              <Button
                onClick={() => {
                  setResultSeen(game.id)
                  setReviewing(true)
                }}
              >
                Review game
              </Button>
              <Button variant="secondary" onClick={() => setResultSeen(game.id)}>
                Close
              </Button>
            </Group>
          </Stack>
        </Card>
      </div>
    )
  }

  function status() {
    if (!game) return null
    const opponent = opponentOf(game, user.id)
    if (isCancelled(game)) return <Badge>Cancelled</Badge>
    if (isOver(game)) return <Badge>{outcomeText(game)}</Badge>
    if (thinking) return <Badge variant="warning">{opponent?.name ?? 'Computer'} is thinking…</Badge>
    if (myTurn) return <Badge variant="success">Your move</Badge>
    if (seat) return <Badge>Waiting for {opponent?.name ?? 'your opponent'}</Badge>
    return <Badge>{turnOf(game) === 'w' ? 'White' : 'Black'} to move</Badge>
  }
}
