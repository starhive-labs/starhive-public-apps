/**
 * The board on the game object itself.
 *
 * A game *is* a Starhive object, so opening one natively — from a search, a report, a link — shows
 * the board on it. `context.objectId` is the object the panel was mounted beside; it is in this
 * app's own space and type, so `objects.get` will answer for it.
 */
import { useStarhiveContext } from '@starhive/bridge'
import { Stack, Text } from '@mantine/core'

import { Board } from '../components/Board'

export function ObjectPanel() {
  const { objectId } = useStarhiveContext()

  if (!objectId) return <Text size="sm">No object.</Text>
  return (
    <Stack gap="md" p="md">
      <Board gameId={objectId} maxBoard={520} />
    </Stack>
  )
}
