/**
 * A board inside somebody's page.
 *
 * The block remembers which game it shows with `useMacroState` — a small JSON value stored on the
 * document node — rather than through a declared macro param, which would mean pasting a UUID into
 * the insert dialog. Pick the game once, in place, and every reader who opens the page sees it live.
 */
import { useAutoResize, useMacroState } from '@starhive/bridge'
import { Button } from '@starhive/ui'
import { Stack, Text } from '@mantine/core'

import { Board } from '../components/Board'
import { GameSection, useGames } from '../components/GameList'

export function Macro() {
  const ref = useAutoResize<HTMLDivElement>()
  const { state, setState, canSave } = useMacroState()
  const { buckets, isLoading } = useGames()

  const gameId = typeof state?.gameId === 'string' ? state.gameId : undefined

  if (gameId) {
    return (
      <div ref={ref}>
        <Stack gap="xs" p="xs">
          {/* A macro is a block in someone's document, not a page. */}
          <Board gameId={gameId} maxBoard={400} />
          {canSave && (
            <Button variant="quiet" onClick={() => void setState({})}>
              Show a different game
            </Button>
          )}
        </Stack>
      </div>
    )
  }

  return (
    <div ref={ref}>
      <Stack gap="xs" p="xs">
        <Text size="sm" fw={600}>
          Pick a game to show
        </Text>
        {!canSave && (
          <Text size="xs" c="dimmed">
            You cannot edit this page, so the block cannot be pointed at a game.
          </Text>
        )}
        {isLoading && <Text size="sm">Loading…</Text>}
        {(['yourMove', 'waiting', 'myOpen', 'open', 'finished'] as const).map((bucket) => (
          <GameSection
            key={bucket}
            title={bucket}
            games={buckets[bucket]}
            onOpen={(id) => void setState({ gameId: id })}
          />
        ))}
      </Stack>
    </div>
  )
}
