import { Box, Group, Text } from '@mantine/core'
import type { ReactNode } from 'react'

import type { Density } from '../model'

/**
 * The product's pill for a single selected value — an option, a boolean, a reference, a user.
 *
 * One primitive rather than four near-copies, which is what platform-ui's `MultiSelectSelectedItem`
 * is doing already; this is that shape without the multi-select machinery around it.
 */
export function Chip({
  label,
  leading,
  density = 'default',
  title,
}: {
  label: string
  /** Avatar, dot or icon shown before the label. */
  leading?: ReactNode
  density?: Density
  title?: string
}) {
  return (
    <Group
      component="span"
      display="inline-flex"
      gap="xs"
      wrap="nowrap"
      maw={density === 'compact' ? 140 : undefined}
      px="sm"
      py={2}
      style={(theme) => ({
        borderRadius: theme.radius.sm,
        backgroundColor: 'var(--mantine-color-neutral-1)',
        maxWidth: '100%',
      })}
      title={title ?? label}
    >
      {leading ? (
        <Box component="span" style={{ display: 'inline-flex', flexShrink: 0 }}>
          {leading}
        </Box>
      ) : null}
      <Text component="span" size="sm" truncate="end">
        {label}
      </Text>
    </Group>
  )
}
