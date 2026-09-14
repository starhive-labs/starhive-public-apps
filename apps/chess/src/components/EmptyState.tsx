/**
 * What a list says when it has nothing in it.
 *
 * A dimmed sentence is not an empty state — it reads like something failed to load. This says what
 * the list is for, and offers the thing you would have come here to do.
 */
import { useTheme } from '@starhive/bridge'
import { Button } from '@starhive/ui'
import { Box, Stack, Text } from '@mantine/core'
import type { ReactNode } from 'react'

import { accent, brandHue } from '../chess/palette'

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: ReactNode
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}) {
  const theme = useTheme()
  const tint = accent(brandHue(theme.colors.primary), theme.colorScheme)
  return (
    <Stack align="center" gap="sm" py={48} px="md">
      <Box
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: tint.background,
          color: tint.foreground,
        }}
      >
        {icon}
      </Box>
      <Text fw={600}>{title}</Text>
      <Text size="sm" c="dimmed" ta="center" maw={360}>
        {description}
      </Text>
      {actionLabel && onAction && (
        <Button onClick={onAction} mt="xs">
          {actionLabel}
        </Button>
      )}
    </Stack>
  )
}
