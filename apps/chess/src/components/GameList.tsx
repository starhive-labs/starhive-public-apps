/**
 * The lobby list.
 *
 * Unlike a board, this reads through `objects.query` — the search index — so a game created a second
 * ago may not be here yet. That is why creating a game opens it directly instead of sending you back
 * to a list that has not noticed it.
 *
 * Games are classified in the browser rather than in StarQL. A query would have to name attributes
 * by their display names, which an admin can rename, and fifty recent games is nothing to sort
 * through locally.
 */
import { useStarhiveContext, useObjectQuery, useToast } from '@starhive/bridge'
import { Badge, Button, Card } from '@starhive/ui'
import { Group, Menu, Stack, Text } from '@mantine/core'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  canCancel,
  type Game,
  gameStatusBadge,
  isCancelled,
  isMyTurn,
  isOver,
  isWaitingForOpponent,
  readGame,
} from '../chess/game'
import { usePoll, useGameActions, useGameType } from '../useGame'

const PAGE = 50

/**
 * How long search-manager takes to notice a write.
 *
 * The board reads `objects.get` and is always current; this list reads a query, which goes through
 * the index. Refetching the instant a game changes therefore re-reads the *old* answer — which is
 * why cancelling a challenge left "Challenges (1)" on screen until a manual refresh.
 */
const INDEX_DELAY_MS = 2000

/**
 * How often the lobby re-reads itself.
 *
 * It used to fetch once and then never again, so a game somebody opened in the last minute simply
 * was not there, and a game that had been claimed still offered its seat. Slower than a board, which
 * is watching one game closely; fast enough that the list is not lying to you.
 */
const LOBBY_POLL_MS = 8000

export type GameBuckets = {
  yourMove: Game[]
  waiting: Game[]
  /** Your own challenges, still waiting for somebody. */
  myOpen: Game[]
  /** Other people's challenges, yours to take. */
  open: Game[]
  finished: Game[]
}

export type UseGames = {
  buckets: GameBuckets
  /**
   * True only until there is something to show — never again.
   *
   * `useObjectQuery` raises its own `isLoading` on every refetch while keeping the data it already
   * has, which is right for the hook and wrong for a screen: with the list polling every few seconds,
   * a caller that renders it flashes "Loading…" over a perfectly good list forever. A refresh is not
   * a load. Anything that wants to know a refresh is in flight can watch [isRefreshing].
   */
  isLoading: boolean
  /** A refresh over data already on screen. Deliberately not rendered anywhere. */
  isRefreshing: boolean
  refetch: () => void
  /**
   * Drop a game from the list now and reconcile with the index shortly.
   *
   * Two halves, because neither is enough on its own: hiding it locally makes the counts right
   * immediately, and the delayed refetch is what makes them right *correctly* — if the write did not
   * actually land, the game comes back rather than staying hidden for the session.
   */
  forget: (gameId: string) => void
}

export function useGames(): UseGames {
  const { user, stateKeyToId } = useStarhiveContext()
  const { ids } = useGameType()
  const { data, isLoading, refetch } = useObjectQuery('order by Created desc', {
    typeKey: 'game',
    limit: PAGE,
  })
  usePoll(refetch, true, LOBBY_POLL_MS)
  const [hidden, setHidden] = useState<readonly string[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const forget = useCallback(
    (gameId: string) => {
      setHidden((current) => (current.includes(gameId) ? current : [...current, gameId]))
      refetch()
      clearTimeout(timer.current)
      timer.current = setTimeout(refetch, INDEX_DELAY_MS)
    },
    [refetch],
  )

  useEffect(() => () => clearTimeout(timer.current), [])

  // Stop hiding a game the moment the index agrees it is gone or cancelled. Without this a failed
  // write would leave the row invisible until the page was reloaded — the bug this replaces, in the
  // other direction.
  useEffect(() => {
    if (!data || !ids) return
    setHidden((current) => {
      const still = current.filter((gameId) => {
        const object = data.result.find((candidate) => candidate.id === gameId)
        return object ? !isCancelled(readGame(object, ids, stateKeyToId)) : false
      })
      return still.length === current.length ? current : still
    })
  }, [data, ids, stateKeyToId])

  const buckets = useMemo<GameBuckets>(() => {
    const empty: GameBuckets = { yourMove: [], waiting: [], myOpen: [], open: [], finished: [] }
    if (!ids || !data) return empty

    for (const object of data.result) {
      if (hidden.includes(object.id)) continue
      const game = readGame(object, ids, stateKeyToId)
      // A called-off challenge is not a game anybody needs to see again.
      if (isCancelled(game)) continue
      const mine = game.white?.id === user.id || game.black?.id === user.id
      if (isOver(game)) {
        if (mine) empty.finished.push(game)
      } else if (isWaitingForOpponent(game)) {
        // Not `openSeat`: a computer game has an empty seat too, and nobody is coming for it.
        if (mine) empty.myOpen.push(game)
        else empty.open.push(game)
      } else if (isMyTurn(game, user.id)) {
        empty.yourMove.push(game)
      } else if (mine) {
        empty.waiting.push(game)
      }
    }
    return empty
  }, [data, hidden, ids, stateKeyToId, user.id])

  return {
    buckets,
    isLoading: isLoading && !data,
    isRefreshing: isLoading && Boolean(data),
    refetch,
    forget,
  }
}

/** What an empty seat is called — an invitation in a human game, the engine in a computer one. */
function seatLabel(game: Game): string {
  return game.opponent === 'computer' ? `Computer (${game.level ?? '?'})` : 'anyone'
}

export function GameRow({
  game,
  onOpen,
  onCancelled,
}: {
  game: Game
  onOpen: (id: string) => void
  /** Told which game went, so a list backed by the search index can drop it before the index has. */
  onCancelled?: (gameId: string) => void
}) {
  const { user } = useStarhiveContext()
  const actions = useGameActions()
  const toast = useToast()
  const status = gameStatusBadge(game, user.id)
  const cancellable = canCancel(game, user.id)

  function cancel() {
    actions
      .cancel(game)
      .then(() => {
        void toast('Game cancelled', 'info')
        onCancelled?.(game.id)
      })
      .catch((failure: Error) => toast(failure.message, 'error'))
  }

  return (
    <Card p="sm">
      <Group justify="space-between" wrap="nowrap">
        {/* The body opens the game. The common action should not cost a trip through a menu. */}
        <Stack
          gap={2}
          style={{ minWidth: 0, flex: 1, cursor: 'pointer' }}
          role="button"
          tabIndex={0}
          onClick={() => onOpen(game.id)}
          onKeyDown={(event) => event.key === 'Enter' && onOpen(game.id)}
        >
          <Text size="sm" fw={500} truncate>
            {game.title}
          </Text>
          <Text size="xs" c="dimmed" truncate>
            {game.white?.name ?? seatLabel(game)} vs {game.black?.name ?? seatLabel(game)}
          </Text>
        </Stack>
        <Group gap="xs" wrap="nowrap">
          {status && <Badge variant={status.tone}>{status.label}</Badge>}
          <Menu position="bottom-end" withinPortal shadow="md">
            <Menu.Target>
              <Button variant="secondary" aria-label="Game actions">
                ⋯
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item onClick={() => onOpen(game.id)}>Open</Menu.Item>
              {cancellable && (
                <Menu.Item color="red" onClick={cancel}>
                  Cancel game
                </Menu.Item>
              )}
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>
    </Card>
  )
}

export function GameSection({
  title,
  games,
  onOpen,
  onCancelled,
}: {
  title: string
  games: Game[]
  onOpen: (id: string) => void
  onCancelled?: (gameId: string) => void
}) {
  if (games.length === 0) return null
  return (
    <Stack gap="xs">
      <Text size="xs" fw={600} c="dimmed" tt="uppercase">
        {title}
      </Text>
      {games.map((game) => (
        <GameRow key={game.id} game={game} onOpen={onOpen} onCancelled={onCancelled} />
      ))}
    </Stack>
  )
}
