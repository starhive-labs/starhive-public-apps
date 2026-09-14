/**
 * The evaluation bar.
 *
 * White fills from whichever end White's back rank is on, so it agrees with the board it stands
 * beside rather than with an abstract convention — a bar that grows downwards while your pieces sit
 * at the top takes a moment to read every single time. All of the deciding is in `evalBarLayout`,
 * which is where it can be tested.
 */
import { Box, Text, Tooltip } from '@mantine/core'

import { evalBarLayout, formatEval } from '../chess/analysis'

export function EvalBar({
  centipawns,
  height,
  orientation,
}: {
  centipawns: number
  height: number
  /** Which colour is at the bottom of the board. */
  orientation: 'white' | 'black'
}) {
  const bar = evalBarLayout(centipawns, orientation)

  return (
    <Tooltip
      label={`${formatEval(centipawns)} for ${centipawns >= 0 ? 'White' : 'Black'}`}
      position="right"
    >
      <Box
        style={{
          position: 'relative',
          width: 18,
          height,
          flexShrink: 0,
          borderRadius: 3,
          overflow: 'hidden',
          background: bar.groundColour,
        }}
      >
        <Box
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: `${bar.bottomPercent}%`,
            background: bar.bottomColour,
            transition: 'height 180ms ease',
          }}
        />
        <Text
          size="9px"
          fw={700}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            textAlign: 'center',
            [bar.labelEdge]: 2,
            color: bar.labelColour,
            pointerEvents: 'none',
          }}
        >
          {formatEval(centipawns)}
        </Text>
      </Box>
    </Tooltip>
  )
}
