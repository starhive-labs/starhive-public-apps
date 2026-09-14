/**
 * The lobby screen, while a challenge waits for somebody to take it.
 *
 * The board is deliberately not drawn until there are two players. Until then it would show the same
 * starting position every game, which tells the waiting player nothing and reads as though the game
 * were already under way.
 *
 * The empty seat is drawn as an empty seat — a dashed outline, no face. An earlier version cycled
 * through coloured discs the way a matchmaking screen does, which was wrong here twice over: the
 * bridge exposes no user directory and no avatar, so there are no real people to show, and animating
 * invented ones suggests candidates are being considered when nothing of the sort is happening. What
 * is actually going on is that the game sits in a list until somebody opens it.
 */
import { Button, Card } from '@starhive/ui'
import { Group, Stack, Text } from '@mantine/core'

import type { Game, Seat } from '../chess/game'
import { controlFor } from '../chess/timeControl'
import { Avatar } from './Avatar'
import { PersonIcon } from './icons'

export function WaitingForOpponent({
  game,
  you,
  yourSeat,
  onCancel,
  cancelling,
}: {
  game: Game
  you: { name?: string; email?: string; id: string }
  yourSeat: Seat
  onCancel?: () => void
  cancelling?: boolean
}) {
  const control = controlFor(game.timeControl)
  const seatName = yourSeat === 'w' ? 'White' : 'Black'
  const openSeatName = yourSeat === 'w' ? 'Black' : 'White'

  return (
    <Card p="xl" style={{ maxWidth: 460, width: '100%' }}>
      {/* Inline, because the app ships no stylesheet of its own and the bundle CSP allows inline
          styles but no external one. */}
      <style>{`
        @keyframes chess-breathe {
          0%   { opacity: 0.45; }
          50%  { opacity: 0.9; }
          100% { opacity: 0.45; }
        }
      `}</style>

      <Stack gap="lg" align="center">
        <Stack gap={4} align="center">
          <Text fw={700} size="lg">
            Waiting for an opponent
          </Text>
          <Text size="sm" c="dimmed" ta="center">
            Anyone in the workspace can take the {openSeatName} seat. The board appears the moment
            somebody does.
          </Text>
        </Stack>

        <Group gap="xl" align="flex-start" justify="center">
          <Stack gap={6} align="center">
            <Avatar name={you.name} email={you.email} seed={you.id} size={72} />
            <Text size="xs" fw={600}>
              {you.name ?? 'You'}
            </Text>
            <Text size="10px" c="dimmed">
              {seatName}
            </Text>
          </Stack>

          <Text size="sm" c="dimmed" fw={700} mt={26}>
            vs
          </Text>

          <Stack gap={6} align="center">
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                border: '2px dashed var(--mantine-color-default-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--mantine-color-dimmed)',
                animation: 'chess-breathe 2.4s ease-in-out infinite',
              }}
            >
              <PersonIcon size={32} />
            </div>
            <Text size="xs" fw={600} c="dimmed">
              Empty seat
            </Text>
            <Text size="10px" c="dimmed">
              {openSeatName}
            </Text>
          </Stack>
        </Group>

        {control && (
          <Text size="xs" c="dimmed">
            {control.label} · the clock starts when the seat is taken
          </Text>
        )}

        {onCancel && (
          <Button variant="secondary" onClick={onCancel} disabled={cancelling}>
            {cancelling ? 'Cancelling…' : 'Cancel game'}
          </Button>
        )}
      </Stack>
    </Card>
  )
}
