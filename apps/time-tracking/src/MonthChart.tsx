import { Box, Group, Skeleton, Stack, Text, Tooltip } from '@mantine/core'

import type { MonthBucket } from './report'
import { formatDecimalHours, formatHours } from './timeEntry'

/** Columns are capped at this width; the band's leftover is air, not bar. */
const MAX_COLUMN_WIDTH = 24
/** The gap between adjacent columns, so two months never read as one block. */
const COLUMN_GAP = 4

/**
 * Hours per month, as columns on a shared baseline.
 *
 * One series, one hue, no legend. The value sits on the cap of every column that is tall enough to
 * take it and in the tooltip otherwise — a number on every column of a two-year chart is noise, so
 * past a dozen months only the tallest are labelled. Empty months are drawn as empty columns, not
 * skipped: the `byMonth` report fills them in, and a chart that hides July says something false
 * about August.
 */
export function MonthChart({
  months,
  isLoading = false,
  height = 120,
  empty = 'Nothing yet.',
}: {
  months: MonthBucket[]
  isLoading?: boolean
  height?: number
  empty?: string
}) {
  if (isLoading && months.length === 0) {
    return <Skeleton height={height + 24} radius="sm" />
  }
  if (months.length === 0 || months.every((month) => month.hours === 0)) {
    return (
      <Text size="sm" c="dimmed">
        {empty}
      </Text>
    )
  }

  const most = Math.max(...months.map((month) => month.hours))
  // Every column, up to a dozen months; beyond that, only the ones tall enough to matter.
  const labelled = months.length <= 12 ? 0 : most * 0.5
  // Every month name up to a year; then every third, so the axis stays legible at two years.
  const axisEvery = months.length <= 12 ? 1 : months.length <= 24 ? 3 : 6

  return (
    <Stack gap={4}>
      <Group
        gap={COLUMN_GAP}
        align="flex-end"
        wrap="nowrap"
        style={{
          height,
          borderBottom: '1px solid var(--mantine-color-default-border)',
          paddingBottom: 0,
        }}
        role="img"
        aria-label={`Hours per month, ${months[0].label} to ${months[months.length - 1].label}`}
      >
        {months.map((month) => {
          const columnHeight = most > 0 ? (month.hours / most) * (height - 18) : 0
          return (
            <Tooltip
              key={month.key}
              label={`${month.label} · ${formatHours(month.hours)} · ${month.count} ${month.count === 1 ? 'entry' : 'entries'}`}
              position="top"
              openDelay={200}
              withinPortal
            >
              <Stack
                gap={2}
                align="center"
                justify="flex-end"
                style={{ flex: 1, minWidth: 0, height: '100%' }}
              >
                {month.hours > 0 && month.hours >= labelled && (
                  <Text size="xs" c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatDecimalHours(month.hours)}
                  </Text>
                )}
                <Box
                  style={{
                    width: '100%',
                    maxWidth: MAX_COLUMN_WIDTH,
                    height: Math.max(columnHeight, month.hours > 0 ? 2 : 0),
                    background: 'var(--mantine-color-primary-filled)',
                    borderRadius: '4px 4px 0 0',
                  }}
                />
              </Stack>
            </Tooltip>
          )
        })}
      </Group>
      <Group gap={COLUMN_GAP} wrap="nowrap">
        {months.map((month, index) => (
          <Text
            key={month.key}
            size="xs"
            c="dimmed"
            ta="center"
            style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden' }}
          >
            {index % axisEvery === 0 ? axisLabel(month, index === 0) : ''}
          </Text>
        ))}
      </Group>
    </Stack>
  )
}

/** `Sep`, and `Sep 26` for the first column and every January, so the year is never a guess. */
function axisLabel(month: MonthBucket, first: boolean): string {
  const [name, year] = month.label.split(' ')
  return first || name === 'Jan' ? `${name} ${year.slice(2)}` : name
}
