import { Box, Stack, Text } from '@mantine/core'
import type { ReactNode } from 'react'

/**
 * Something on the panel is wrong, said where it can be read in either scheme.
 *
 * Mantine's `Alert` in its `light` variant was used here and failed in dark mode: it paints a
 * translucent wash of the colour over whatever is behind it, which on the near-black panel came out
 * as a muddy brown, and the body text inside it was a dark grey on that brown — unreadable, on the
 * one message that says the panel cannot be trusted.
 *
 * So this is built from the theme's own tokens instead of a stock palette: the outline is the
 * scheme's `negative` colour, the fill is a little of that colour mixed into the panel's own ground
 * (`--mantine-color-body`, which `useApplyHostTheme` sets from the host), and the text is the normal
 * text colour. Each of those has a light and a dark value, so the contrast is the theme's to get
 * right rather than this component's.
 */
export function Notice({
  title,
  tone = 'negative',
  children,
}: {
  title?: string
  /** `negative` for something wrong, `warning` for something to know before going on. */
  tone?: 'negative' | 'warning'
  children: ReactNode
}) {
  const accent = `var(--mantine-color-${tone}-filled)`
  return (
    <Box
      role="alert"
      style={{
        border: `1px solid ${accent}`,
        borderRadius: 'var(--mantine-radius-md)',
        background: `color-mix(in srgb, ${accent} 10%, var(--mantine-color-body))`,
        color: 'var(--mantine-color-text)',
        padding: '10px 12px',
      }}
    >
      <Stack gap={4}>
        {title && (
          <Text size="sm" fw={600} c={accent}>
            {title}
          </Text>
        )}
        {children}
      </Stack>
    </Box>
  )
}

/** A line of a notice. Inherits the notice's text colour rather than Mantine's default. */
export function NoticeText({ children }: { children: ReactNode }) {
  return (
    <Text size="xs" c="inherit">
      {children}
    </Text>
  )
}
