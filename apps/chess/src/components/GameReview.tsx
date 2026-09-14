/**
 * Walking through a finished game, one move at a time.
 *
 * Everything here is read from the stored evaluations — the engine runs once, when somebody first
 * asks, and the answer lives on the object afterwards. Reopening a reviewed game is free, and it is
 * free for the other player too, on their machine, which is the point of storing it rather than
 * keeping it in a tab.
 */
import { useStarhiveContext, useTheme, useToast } from '@starhive/bridge'
import { Badge, Button, Card } from '@starhive/ui'
import { Box, Group, Progress, ScrollArea, Stack, Text } from '@mantine/core'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chessboard } from 'react-chessboard'

import {
  accuracy,
  comment,
  faultCounts,
  formatEval,
  isFault,
  JUDGEMENT_LABEL,
  reviewMoves,
  serializeEvals,
} from '../chess/analysis'
import { type Game, moveHighlights, replay, seatOf } from '../chess/game'
import { ANALYSIS_ENGINE, storedAnalysis, useAnalysis } from '../engine/useAnalysis'
import { useGameActions } from '../useGame'
import { Annotation } from './Annotation'
import { boardColours } from '../chess/boardTheme'
import { boardLayout, GAP, keepInView, PANEL } from './boardLayout'
import { EvalBar } from './EvalBar'

const HIGHLIGHT = { latest: 'rgba(255, 199, 44, 0.55)', previous: 'rgba(255, 199, 44, 0.22)' } as const

/** Until the left column has been measured. Roughly the board plus its row of controls. */
const CONTROLS_FALLBACK = 48

export function GameReview({
  game,
  maxBoard = 720,
  onExit,
  onAnalysed,
}: {
  game: Game
  maxBoard?: number
  onExit: () => void
  onAnalysed: () => void
}) {
  const { user } = useStarhiveContext()
  const theme = useTheme()
  const squares = useMemo(() => boardColours(theme.colors.primary), [theme.colors.primary])
  const actions = useGameActions()
  const toast = useToast()
  const analysis = useAnalysis(game)

  const listViewport = useRef<HTMLDivElement>(null)
  const activeRow = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  /**
   * The panel's height, taken from the board column rather than computed.
   *
   * The alternative is a constant standing in for the board, the gap and the button row — which is
   * right until someone changes a spacing token, and then silently is not.
   */
  const boardColumn = useRef<HTMLDivElement>(null)
  const [columnHeight, setColumnHeight] = useState(0)
  useEffect(() => {
    const element = boardColumn.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => entry && setColumnHeight(entry.contentRect.height))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const frame = useCallback((element: HTMLDivElement | null) => {
    if (element) setWidth(element.getBoundingClientRect().width)
  }, [])
  const viewport = typeof window === 'undefined' ? 800 : window.innerHeight
  // The bar and its gap come out of the board's width, or the two together overflow the column.
  const { size, sideBySide } = boardLayout(Math.max(0, width - 26), viewport, maxBoard)

  const { fens, sans } = useMemo(() => replay(game), [game])
  // What was saved wins over what this session computed: they are the same numbers, and preferring
  // the stored copy means a reload shows the same review rather than offering to redo it.
  const evals = storedAnalysis(game).length ? storedAnalysis(game) : analysis.evals
  const analysed = evals.length === fens.length

  const moves = useMemo(() => (analysed ? reviewMoves(sans, evals) : []), [analysed, sans, evals])
  // A review opens at move one, not at the end: the point of it is walking forward through the game.
  const [ply, setPly] = useState(0)

  const go = useCallback(
    (next: number) => setPly(Math.max(0, Math.min(sans.length, next))),
    [sans.length],
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') go(ply - 1)
      if (event.key === 'ArrowRight') go(ply + 1)
      if (event.key === 'Home') go(0)
      if (event.key === 'End') go(sans.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, ply, sans.length])

  function analyse() {
    void analysis.run().then((scores) => {
      if (scores.length === 0) return
      actions
        .saveAnalysis(game, serializeEvals(scores), ANALYSIS_ENGINE)
        .then(() => {
          void toast('Analysis saved to the game', 'success')
          onAnalysed()
        })
        // The review still works from what is in memory; only the saving failed, and saying so is
        // better than silently making the next person pay for it again.
        .catch(() => toast('Analysed, but could not save it to the game', 'warning'))
    })
  }

  const orientation = seatOf(game, user.id) === 'b' ? 'black' : 'white'
  const highlights = useMemo(() => moveHighlights(game.moves.slice(0, ply)), [game.moves, ply])
  const squareStyles = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(highlights).map(([square, weight]) => [
          square,
          { backgroundColor: HIGHLIGHT[weight] },
        ]),
      ),
    [highlights],
  )

  const current = ply > 0 ? moves[ply - 1] : undefined

  /**
   * Keep the move being viewed on screen.
   *
   * Scrolls the list and nothing else — `scrollIntoView` would happily scroll the page the app is
   * embedded in, which in an iframe means yanking somebody's whole document sideways. Only moves
   * when the row is actually out of view, so stepping through the middle of a visible list does not
   * jump.
   */
  useEffect(() => {
    const viewport = listViewport.current
    const row = activeRow.current
    if (!viewport || !row) return
    viewport.scrollTop = keepInView(
      viewport.getBoundingClientRect(),
      row.getBoundingClientRect(),
      viewport.scrollTop,
    )
  }, [ply])

  return (
    <div ref={frame} style={{ width: '100%' }}>
      {/* The title spans both columns, so the board and the panel beside it start at the same line —
          and, being the same height, finish at the same one. */}
      <Group justify="space-between" align="center" wrap="nowrap" mb="sm">
        <Text fw={600} truncate>
          Review · {game.title}
        </Text>
        <Button variant="quiet" onClick={onExit}>
          Close
        </Button>
      </Group>

      <Group align="flex-start" justify="center" gap={GAP} wrap={sideBySide ? 'nowrap' : 'wrap'}>
        <Stack ref={boardColumn} gap="sm" style={{ flexShrink: 0 }}>
          <Group gap={8} align="flex-start" wrap="nowrap">
            {analysed && (
              <EvalBar centipawns={evals[ply]} height={size} orientation={orientation} />
            )}
            <Chessboard
              position={fens[ply]}
              boardWidth={size}
              boardOrientation={orientation}
              arePiecesDraggable={false}
              customSquareStyles={squareStyles}
              customLightSquareStyle={{ backgroundColor: squares.light }}
              customDarkSquareStyle={{ backgroundColor: squares.dark }}
            />
          </Group>

          <Group gap="xs" justify="center">
            <Button variant="secondary" onClick={() => go(0)} disabled={ply === 0}>
              ⏮
            </Button>
            <Button variant="secondary" onClick={() => go(ply - 1)} disabled={ply === 0}>
              ← Back
            </Button>
            <Text size="sm" c="dimmed" w={70} ta="center">
              {ply} / {sans.length}
            </Text>
            <Button variant="secondary" onClick={() => go(ply + 1)} disabled={ply === sans.length}>
              Next →
            </Button>
            <Button
              variant="secondary"
              onClick={() => go(sans.length)}
              disabled={ply === sans.length}
            >
              ⏭
            </Button>
          </Group>
        </Stack>

        <Stack
          gap="sm"
          style={{
            width: sideBySide ? PANEL : '100%',
            flexShrink: 0,
            // Matched to the board column, so the two end level. The move list inside absorbs the
            // difference by scrolling.
            height: sideBySide ? columnHeight || size + CONTROLS_FALLBACK : undefined,
          }}
        >
          {!analysed && unanalysed()}
          {analysed && (
            <>
              <Card p="sm">
                <Stack gap={6}>
                  {current ? (
                    <>
                      <Group gap="xs" align="center">
                        <Text fw={600} size="sm">
                          {Math.floor(current.ply / 2) + 1}
                          {current.side === 'w' ? '.' : '…'} {current.san}
                        </Text>
                        <Annotation judgement={current.judgement} size={20} />
                      </Group>
                      <Text size="xs" c="dimmed">
                        {comment(current)}
                      </Text>
                    </>
                  ) : (
                    <Text size="xs" c="dimmed">
                      The starting position, even at {formatEval(evals[0])}. Step forward to walk
                      through the game.
                    </Text>
                  )}
                </Stack>
              </Card>
              {summary()}
              {moveTable()}
            </>
          )}
        </Stack>
      </Group>
    </div>
  )

  // Render helpers, called rather than mounted — see the note in Board.tsx.
  function unanalysed() {
    return (
      <Card p="sm">
        <Stack gap="xs">
          <Text size="sm" fw={600}>
            Analyse this game
          </Text>
          <Text size="xs" c="dimmed">
            Every position is evaluated in your browser and the result is saved to the game, so this
            happens once — for you and for your opponent. About {Math.round(fens.length * 0.3)}s for
            this game.
          </Text>
          {analysis.isRunning ? (
            <>
              <Progress value={analysis.progress} size="sm" />
              <Text size="xs" c="dimmed">
                {analysis.progress}% — position {Math.round((analysis.progress / 100) * fens.length)}{' '}
                of {fens.length}
              </Text>
            </>
          ) : (
            <Button onClick={analyse}>Analyse</Button>
          )}
          {analysis.error && (
            <Text size="xs" c="red">
              {analysis.error.message}
            </Text>
          )}
        </Stack>
      </Card>
    )
  }

  /**
   * Both players, side by side.
   *
   * One card headed "You" was a bad idea: it asks the reader to trust an attribution they cannot
   * check, and when it disagrees with the move list beside it there is no way to tell which is
   * wrong. Showing both rows, named, with the viewer marked, means the numbers can be read straight
   * off against the flags in the move list.
   */
  function summary() {
    const seat = seatOf(game, user.id)
    const sides: Array<{ side: 'w' | 'b'; name: string }> = [
      { side: 'w', name: game.white?.name ?? 'White' },
      {
        side: 'b',
        name: game.black?.name ?? (game.opponent === 'computer' ? `Computer (${game.level})` : 'Black'),
      },
    ]

    return (
      <Card p="sm">
        <Stack gap="sm">
          {sides.map(({ side, name }) => {
            const counts = faultCounts(moves, side)
            return (
              <Stack key={side} gap={2}>
                <Group gap={6} align="center" wrap="nowrap">
                  <Text size="xs" fw={600} truncate>
                    {name}
                  </Text>
                  <Text size="10px" c="dimmed">
                    {side === 'w' ? 'White' : 'Black'}
                  </Text>
                  {seat === side && <Badge size="xs">You</Badge>}
                </Group>
                <Group gap="xs" align="baseline">
                  <Text size="sm" fw={700}>
                    {accuracy(moves, side)}%
                  </Text>
                  <Text size="xs" c="dimmed">
                    {counts.blunders} blunders · {counts.mistakes} mistakes · {counts.inaccuracies}{' '}
                    inaccuracies
                  </Text>
                </Group>
              </Stack>
            )
          })}
        </Stack>
      </Card>
    )
  }

  function moveTable() {
    return (
      <Card
        p="md"
        style={{
          // Takes whatever the comment and summary above it leave, rather than a guessed height.
          flex: sideBySide ? 1 : undefined,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Text size="xs" fw={600} c="dimmed" tt="uppercase" mb="sm">
          Moves
        </Text>
        <ScrollArea
          viewportRef={listViewport}
          type="auto"
          style={{ flex: 1, minHeight: 0 }}
          mah={sideBySide ? undefined : 240}
        >
          <Stack gap={0}>
            {moves.map((move) => (
              <Box
                key={move.ply}
                ref={ply === move.ply + 1 ? activeRow : undefined}
                role="button"
                tabIndex={0}
                onClick={() => go(move.ply + 1)}
                onKeyDown={(event) => event.key === 'Enter' && go(move.ply + 1)}
                style={{
                  cursor: 'pointer',
                  padding: '4px 6px',
                  borderRadius: 4,
                  background:
                    ply === move.ply + 1 ? 'var(--mantine-color-default-hover)' : undefined,
                }}
              >
                <Group gap="xs" wrap="nowrap" align="baseline">
                  <Text size="xs" c="dimmed" w={30} ta="right" style={{ flexShrink: 0 }}>
                    {Math.floor(move.ply / 2) + 1}
                    {move.side === 'w' ? '.' : '…'}
                  </Text>
                  <Text size="sm" style={{ flex: 1 }}>
                    {move.san}
                  </Text>
                  <Annotation judgement={move.judgement} size={16} />
                  <Text size="xs" c="dimmed" w={42} ta="right" style={{ flexShrink: 0 }}>
                    {formatEval(move.after)}
                  </Text>
                </Group>
              </Box>
            ))}
          </Stack>
        </ScrollArea>
      </Card>
    )
  }
}
