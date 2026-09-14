/**
 * The move list, beside the board.
 *
 * Paired by move number the way a scoresheet is, rather than run together as prose: the point of
 * having it on screen is finding move 23 without counting.
 */
import { Card } from '@starhive/ui'
import { Box, Group, ScrollArea, Text } from '@mantine/core'
import { useEffect, useRef } from 'react'

export function MoveList({ moves, height }: { moves: string[]; height: number }) {
  const viewport = useRef<HTMLDivElement>(null)

  // Follow the game: the move you want to see is almost always the last one.
  useEffect(() => {
    viewport.current?.scrollTo({ top: viewport.current.scrollHeight, behavior: 'smooth' })
  }, [moves.length])

  const pairs: Array<[number, string, string | undefined]> = []
  for (let index = 0; index < moves.length; index += 2) {
    pairs.push([index / 2 + 1, moves[index], moves[index + 1]])
  }

  return (
    <Card p="md" style={{ width: '100%' }}>
      <Text size="xs" fw={600} c="dimmed" tt="uppercase" mb="sm">
        Moves
      </Text>
      {moves.length === 0 ? (
        <Text size="sm" c="dimmed" py="xs">
          No moves yet.
        </Text>
      ) : (
        <ScrollArea.Autosize mah={height} viewportRef={viewport} type="auto">
          <Box>
            {pairs.map(([number, white, black]) => (
              <Group key={number} gap="xs" wrap="nowrap" align="baseline" py={3}>
                <Text size="xs" c="dimmed" w={28} ta="right" style={{ flexShrink: 0 }}>
                  {number}.
                </Text>
                <Text size="sm" w={70} style={{ flexShrink: 0 }}>
                  {white}
                </Text>
                <Text size="sm" w={70} style={{ flexShrink: 0 }}>
                  {black ?? ''}
                </Text>
              </Group>
            ))}
          </Box>
        </ScrollArea.Autosize>
      )}
    </Card>
  )
}
