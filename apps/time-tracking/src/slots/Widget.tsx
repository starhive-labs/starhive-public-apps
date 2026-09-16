import { Group, Stack, Text } from '@mantine/core'
import { useStarhiveContext } from '@starhive/bridge'
import { useMemo } from 'react'

import { Breakdown } from '../Breakdown'
import { byPerson, totalHours } from '../report'
import { StatTile } from '../StatTile'
import { dateFromIso, formatHours, periodRange } from '../timeEntry'
import { useToday } from '../useToday'
import { useTimeEntries, useTotalHours } from '../useTimeEntries'

/**
 * This month, for a dashboard: the total, who it came from, and your own part of it.
 *
 * Read-only and compact — a widget is glanced at, not worked in. Deliberately not wrapped in a
 * `Card`: the dashboard cell around this iframe already paints the background, border and radius
 * the person configured, and hands the app a transparent ground so it shows through (see
 * `useApplyHostTheme`). A card here would be a second frame inside the one they chose.
 */
export function Widget() {
  const { user } = useStarhiveContext()
  // Recomputed when the day rolls over: a dashboard frame outlives the month it was opened in,
  // and a widget captioned "this month" must not still be querying the last one.
  const today = useToday()
  const filter = useMemo(() => ({ range: periodRange('month', dateFromIso(today)) }), [today])
  const entries = useTimeEntries(filter)
  const total = useTotalHours(filter)

  const rows = entries.entries
  const people = useMemo(() => byPerson(rows), [rows])
  const mine = useMemo(
    () => totalHours(rows.filter((entry) => entry.user.id === user.id)),
    [rows, user.id],
  )
  const headline = total.hours ?? totalHours(rows)
  const loading = entries.isLoading && rows.length === 0

  return (
    <Stack gap="sm" p="sm">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <StatTile
          bare
          label="logged this month"
          value={formatHours(headline)}
          loading={loading && total.isLoading}
        />
        <StatTile
          bare
          label="by you"
          value={formatHours(mine)}
          hint={headline > 0 && mine > 0 ? `${Math.round((mine / headline) * 100)}%` : undefined}
          loading={loading}
        />
      </Group>
      {entries.error ? (
        <Text size="xs" c="negative.6">
          {entries.error.message}
        </Text>
      ) : (
        <Breakdown
          shares={people}
          isLoading={loading}
          max={5}
          density="compact"
          empty="Nobody has logged time this month."
        />
      )}
    </Stack>
  )
}
