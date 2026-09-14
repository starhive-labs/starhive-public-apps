/** "Your move in N games" — a dashboard nudge. */
import { Stack, Text } from '@mantine/core'
import { useNavigate } from '@starhive/bridge'

import { GameSection, useGames } from '../components/GameList'

export function Widget() {
  const { buckets, isLoading } = useGames()
  const navigate = useNavigate()

  if (isLoading) return <Text size="sm">Loading…</Text>

  if (buckets.yourMove.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        Nothing waiting on you.
      </Text>
    )
  }

  return (
    <Stack gap="xs">
      <GameSection
        title={`Your move in ${buckets.yourMove.length}`}
        games={buckets.yourMove}
        // A widget has no room for a board, so opening one goes to the object's own page — where the
        // objectPanel module draws it.
        onOpen={(id) => void navigate(`/object/${id}`)}
      />
    </Stack>
  )
}
