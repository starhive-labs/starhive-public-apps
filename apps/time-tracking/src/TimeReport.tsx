import { SimpleGrid, Stack, Text } from '@mantine/core'
import { Card } from '@starhive/ui'
import { useEffect, useMemo } from 'react'

import { Breakdown } from './Breakdown'
import { EntriesList } from './EntriesList'
import { MonthChart } from './MonthChart'
import { byMonth, byPerson, byWorkItem, distinctPeople, totalHours } from './report'
import { StatTile } from './StatTile'
import { type EntryFilter, formatHours } from './timeEntry'
import { MAX_ENTRIES, useTimeEntries, useTotalHours } from './useTimeEntries'

/**
 * Everything a screen says about a set of entries: the headline numbers, who logged them, when,
 * on what, and the entries themselves — all from one fetch, so the table always agrees with the
 * chart above it.
 *
 * Shared by the Time tab (filtered to one object) and the app page (filtered to a period and maybe
 * a person). The headline total is an index aggregate and exact; the breakdowns are computed from
 * the fetched rows, which are capped, and the screen says so when the cap is hit.
 */
export function TimeReport({
  filter,
  periodLabel,
  enabled = true,
  showWorkItems = false,
  currentUserId,
  reloadKey = 0,
}: {
  filter: EntryFilter
  /** What the period is called in the headline tile — see `periodSummary`. */
  periodLabel: string
  /** False while the screen does not yet know what it is on; nothing is fetched. */
  enabled?: boolean
  /** Break down per work item and show the column — for a list spanning more than one object. */
  showWorkItems?: boolean
  currentUserId: string
  /** Bump after a write this screen made to re-read everything. */
  reloadKey?: number
}) {
  const entries = useTimeEntries(filter, { enabled })
  const total = useTotalHours(filter, { enabled })
  const bounded = Boolean(filter.range?.from || filter.range?.to)
  const allTime = useTotalHours(
    { workItemId: filter.workItemId, userId: filter.userId },
    { enabled: enabled && bounded },
  )

  const { refetch: refetchEntries } = entries
  const { refetch: refetchTotal } = total
  const { refetch: refetchAllTime } = allTime
  useEffect(() => {
    if (reloadKey === 0) return
    refetchEntries()
    refetchTotal()
    if (bounded) refetchAllTime()
  }, [reloadKey, bounded, refetchEntries, refetchTotal, refetchAllTime])

  const rows = entries.entries
  const people = useMemo(() => byPerson(rows), [rows])
  const months = useMemo(() => byMonth(rows, filter.range ?? {}), [rows, filter.range])
  const items = useMemo(() => (showWorkItems ? byWorkItem(rows) : []), [rows, showWorkItems])
  const mine = useMemo(
    () => totalHours(rows.filter((entry) => entry.user.id === currentUserId)),
    [rows, currentUserId],
  )

  // The aggregate is exact; the rows are a fallback for a host that cannot aggregate.
  const headline = total.hours ?? totalHours(rows)
  const loading = entries.isLoading && rows.length === 0

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
        <StatTile
          label={`Logged · ${periodLabel}`}
          value={formatHours(headline)}
          hint={
            bounded && allTime.hours !== undefined && allTime.hours !== headline
              ? `${formatHours(allTime.hours)} all time`
              : undefined
          }
          loading={loading && total.isLoading}
        />
        <StatTile
          label={entries.total === 1 ? 'Entry' : 'Entries'}
          value={entries.total}
          loading={loading}
        />
        <StatTile
          label={distinctPeople(rows) === 1 ? 'Person' : 'People'}
          value={distinctPeople(rows)}
          loading={loading}
        />
        <StatTile
          label="You"
          value={formatHours(mine)}
          hint={
            headline > 0 && mine > 0
              ? `${Math.round((mine / headline) * 100)}% of the total`
              : undefined
          }
          loading={loading}
        />
      </SimpleGrid>

      {entries.error && (
        <Text size="sm" c="negative.6">
          {entries.error.message}
        </Text>
      )}

      <SimpleGrid cols={{ base: 1, md: showWorkItems ? 3 : 2 }} spacing="sm">
        <Card>
          <Stack gap="sm">
            <Text fw={600} size="sm">
              Per person
            </Text>
            <Breakdown shares={people} isLoading={loading} empty="Nobody has logged time yet." />
          </Stack>
        </Card>
        <Card>
          <Stack gap="sm">
            <Text fw={600} size="sm">
              Per month
            </Text>
            <MonthChart
              months={months}
              isLoading={loading}
              empty="Nothing logged in this period."
            />
          </Stack>
        </Card>
        {showWorkItems && (
          <Card>
            <Stack gap="sm">
              <Text fw={600} size="sm">
                Per work item
              </Text>
              <Breakdown
                shares={items}
                isLoading={loading}
                empty="Nothing logged in this period."
              />
            </Stack>
          </Card>
        )}
      </SimpleGrid>

      <Card>
        <Stack gap="sm">
          <Text fw={600} size="sm">
            Entries
          </Text>
          {entries.truncated && (
            <Text size="xs" c="warning.6">
              Showing the most recent {MAX_ENTRIES} of {entries.total} entries. The breakdowns above
              cover those; the total is exact. Pick a shorter period to see everything.
            </Text>
          )}
          <EntriesList
            entries={rows}
            isLoading={entries.isLoading}
            error={null}
            showWorkItem={showWorkItems}
            currentUserId={currentUserId}
            onDeleted={(id) => {
              entries.forget(id)
              // The index lags the delete by a second or two; the aggregate is asked again once
              // that has passed, so the headline does not briefly disagree with the list.
              setTimeout(() => {
                refetchTotal()
                if (bounded) refetchAllTime()
              }, 2000)
            }}
            emptyMessage={
              bounded ? 'Nothing logged in this period.' : 'No time logged yet — be the first.'
            }
          />
        </Stack>
      </Card>
    </Stack>
  )
}
