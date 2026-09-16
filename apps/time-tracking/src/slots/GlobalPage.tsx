import { Group, Stack, Switch, Text, Title } from '@mantine/core'
import { useStarhiveContext } from '@starhive/bridge'
import { Card } from '@starhive/ui'
import { useMemo, useState } from 'react'

import { LogTimeForm } from '../LogTimeForm'
import { PeriodSelect, periodSummary } from '../PeriodSelect'
import { dateFromIso, type PeriodChoice, rangeFor } from '../timeEntry'
import { TimeReport } from '../TimeReport'
import { useReloadAfterIndex } from '../useReloadAfterIndex'
import { useToday } from '../useToday'

/**
 * The app page: time across every work item.
 *
 * The same report as the Time tab, unfiltered by object and so with a per-work-item breakdown as
 * well — plus a switch to see only your own time, which is what most people open a timesheet for.
 *
 * Time can be logged from here against any object of any nominated type, which is new: while an
 * entry held a typed REFERENCE, the app could only list its own `Work Item` type and this form had
 * to send people to the object's own tab whenever an admin pointed the setting elsewhere.
 */
export function GlobalPage() {
  const { user } = useStarhiveContext()
  const [period, setPeriod] = useState<PeriodChoice>({ period: 'month' })
  const [onlyMine, setOnlyMine] = useState(false)
  const { key, pending, reload } = useReloadAfterIndex()
  // So a page left open overnight reckons "this week" from today, not from whenever it was opened.
  const today = useToday()

  const filter = useMemo(
    () => ({
      range: rangeFor(period, dateFromIso(today)),
      userId: onlyMine ? user.id : undefined,
    }),
    [period, today, onlyMine, user.id],
  )

  return (
    <Stack gap="md" p="lg">
      <Group justify="space-between" align="center" wrap="wrap">
        <Title order={3}>Time Tracking</Title>
        <Group gap="md">
          {pending && (
            <Text size="xs" c="dimmed">
              Updating…
            </Text>
          )}
          <Switch
            size="xs"
            label="Only my time"
            checked={onlyMine}
            onChange={(event) => setOnlyMine(event.currentTarget.checked)}
          />
          <PeriodSelect value={period} onChange={setPeriod} />
        </Group>
      </Group>

      <Card>
        <Stack gap="sm">
          <Text fw={600} size="sm">
            Log time
          </Text>
          <LogTimeForm onLogged={reload} />
        </Stack>
      </Card>

      <TimeReport
        filter={filter}
        periodLabel={periodSummary(period, dateFromIso(today))}
        showWorkItems
        currentUserId={user.id}
        reloadKey={key}
      />
    </Stack>
  )
}
