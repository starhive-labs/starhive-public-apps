import { Box, Group, Skeleton, Stack, Text, Tooltip } from '@mantine/core'

import type { Share } from './report'
import { formatHours } from './timeEntry'

/** The bar's thickness. Thin on purpose: the row is read by its label and value, the bar compares. */
const BAR_HEIGHT = 8

/**
 * Hours per something, as a ranked bar list.
 *
 * One series, so one hue — the workspace's primary — and no legend: the title above the list says
 * what it is. Bars grow from a shared baseline on the left, the data end is rounded, and the value
 * sits at the tip in text ink rather than on the bar, where it would be a number in the data colour.
 * Past `max` rows the tail folds into "Other", because a 30-person list is a table, not a chart.
 */
export function Breakdown({
  shares,
  isLoading = false,
  max = 8,
  empty = 'Nothing yet.',
  density = 'default',
}: {
  shares: Share[]
  isLoading?: boolean
  max?: number
  empty?: string
  /** `compact` for a widget: tighter rows, no percentage. */
  density?: 'default' | 'compact'
}) {
  if (isLoading && shares.length === 0) {
    return (
      <Stack gap={8}>
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} height={BAR_HEIGHT + 12} radius="sm" />
        ))}
      </Stack>
    )
  }
  if (shares.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        {empty}
      </Text>
    )
  }

  const rows = fold(shares, max)
  const most = Math.max(...rows.map((row) => row.hours), 0)
  const compact = density === 'compact'

  return (
    <Stack gap={compact ? 6 : 10} role="list">
      {rows.map((row) => (
        <Tooltip
          key={row.key}
          label={`${row.label} · ${formatHours(row.hours)} · ${row.count} ${row.count === 1 ? 'entry' : 'entries'} · ${percent(row.share)}`}
          position="top-start"
          openDelay={200}
          withinPortal
        >
          <Group gap="sm" wrap="nowrap" role="listitem" align="center">
            <Text
              size={compact ? 'xs' : 'sm'}
              truncate
              title={row.label}
              style={{ flex: '0 0 32%', minWidth: 0 }}
              c={row.key === OTHER_KEY ? 'dimmed' : undefined}
            >
              {row.label}
            </Text>
            <Box style={{ flex: 1, minWidth: 0 }}>
              <Box
                style={{
                  height: BAR_HEIGHT,
                  width: `${most > 0 ? Math.max((row.hours / most) * 100, 1) : 0}%`,
                  background:
                    row.key === OTHER_KEY
                      ? 'var(--mantine-color-neutral-4)'
                      : 'var(--mantine-color-primary-filled)',
                  borderRadius: `0 ${BAR_HEIGHT / 2}px ${BAR_HEIGHT / 2}px 0`,
                }}
              />
            </Box>
            <Text
              size={compact ? 'xs' : 'sm'}
              style={{ flex: '0 0 auto', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}
            >
              {formatHours(row.hours)}
              {!compact && (
                <Text component="span" c="dimmed" size="xs">
                  {' '}
                  · {percent(row.share)}
                </Text>
              )}
            </Text>
          </Group>
        </Tooltip>
      ))}
    </Stack>
  )
}

const OTHER_KEY = '__other__'

/** The first `max - 1` rows, then everything else as one "Other" row — never a truncated list. */
function fold(shares: Share[], max: number): Share[] {
  if (shares.length <= max) return shares
  const kept = shares.slice(0, max - 1)
  const rest = shares.slice(max - 1)
  return [
    ...kept,
    {
      key: OTHER_KEY,
      label: `Other (${rest.length})`,
      hours: rest.reduce((sum, share) => sum + share.hours, 0),
      count: rest.reduce((sum, share) => sum + share.count, 0),
      share: rest.reduce((sum, share) => sum + share.share, 0),
    },
  ]
}

function percent(share: number): string {
  return `${Math.round(share * 100)}%`
}
