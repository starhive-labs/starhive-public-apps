/** Initials on a coloured disc. See `src/chess/avatar.ts` for why it is not a photograph. */
import { Box, Text } from '@mantine/core'

import { avatarHue, initialsOf } from '../chess/avatar'

export function Avatar({
  name,
  email,
  seed,
  size = 64,
  /** Overrides the hue derived from [seed] — used by the cycling placeholder. */
  hue,
  label,
}: {
  name?: string
  email?: string
  seed?: string
  size?: number
  hue?: number
  label?: string
}) {
  const tone = hue ?? avatarHue(seed ?? name ?? email)
  return (
    <Box
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `hsl(${tone} 45% 55%)`,
        color: '#fff',
        flexShrink: 0,
        transition: 'background 300ms ease',
      }}
      aria-label={label ?? name}
    >
      <Text fw={700} style={{ fontSize: size * 0.36, lineHeight: 1 }}>
        {label ?? initialsOf(name, email)}
      </Text>
    </Box>
  )
}
