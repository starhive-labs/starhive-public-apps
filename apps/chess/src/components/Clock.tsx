/**
 * One side's clock.
 *
 * Dark when it is not running, lit when it is, red when it is nearly gone — the same three states a
 * physical clock has, which is all a player reads at a glance.
 */
import { Box, Text } from '@mantine/core'

import { formatClock } from '../chess/timeControl'

const LOW_MS = 20_000

export function Clock({
  ms,
  running,
  width,
}: {
  ms: number
  running: boolean
  width?: number
}) {
  const low = ms <= LOW_MS
  return (
    <Box
      style={{
        width,
        padding: '2px 10px',
        borderRadius: 6,
        textAlign: 'center',
        // Fixed, not themed: a chess clock is the same object in a dark room and a light one.
        background: running ? (low ? '#c8372d' : '#f0f0f0') : '#2b2b2b',
        color: running && !low ? '#1a1a1a' : '#f0f0f0',
        // A monospace figure stops the whole row jittering as the digits change width.
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <Text size="lg" fw={700} style={{ fontVariantNumeric: 'tabular-nums', lineHeight: 1.4 }}>
        {formatClock(ms)}
      </Text>
    </Box>
  )
}
