import { Group, Stack, Text, Title } from '@mantine/core'
import { useStarhiveContext } from '@starhive/bridge'
import { Card } from '@starhive/ui'
import { useMemo, useState } from 'react'

import { LogTimeForm } from '../LogTimeForm'
import { PeriodSelect, periodSummary } from '../PeriodSelect'
import { dateFromIso, type PeriodChoice, rangeFor } from '../timeEntry'
import { TimeReport } from '../TimeReport'
import { useReloadAfterIndex } from '../useReloadAfterIndex'
import { useToday } from '../useToday'
import { useWorkItem } from '../useWorkItem'

/**
 * The "Time" tab on an object — the product.
 *
 * Log time on this object; see the total, who logged what, and how it splits per month; and the
 * entries themselves. The tab is only offered on the type an admin nominated (`showFor` in the
 * manifest), and the object is read once to learn its name and confirm it can be logged against.
 */
export function ObjectPanel() {
  const { objectId, user } = useStarhiveContext()
  const workItem = useWorkItem(objectId)
  const [period, setPeriod] = useState<PeriodChoice>({ period: 'all' })
  const { key, pending, reload } = useReloadAfterIndex()
  // So a panel left open overnight reckons "this week" from today, not from whenever it was opened.
  const today = useToday()

  const filter = useMemo(
    () => ({ workItemId: objectId, range: rangeFor(period, dateFromIso(today)) }),
    [objectId, period, today],
  )

  if (workItem.isLoading) {
    return (
      <Stack gap="md" p="lg">
        <Title order={3}>Time</Title>
        <Text size="sm" c="dimmed">
          Loading…
        </Text>
      </Stack>
    )
  }

  if (!workItem.readable) {
    return (
      <Stack gap="md" p="lg">
        <Title order={3}>Time</Title>
        <Text size="sm" c="dimmed">
          Time cannot be logged on this object.
        </Text>
        {workItem.problem && (
          <Text size="xs" c="dimmed">
            {workItem.problem}
          </Text>
        )}
      </Stack>
    )
  }

  return (
    <Stack gap="md" p="lg">
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <Stack gap={0}>
          {/* `||`, not `??`: an object whose label is empty, or restricted for this viewer, reads
              back as an empty string rather than as nothing at all. */}
          <Title order={3}>Time on {workItem.label || 'this object'}</Title>
          {workItem.typeName && (
            <Text size="xs" c="dimmed">
              {workItem.typeName}
            </Text>
          )}
        </Stack>
        <Group gap="sm">
          {pending && (
            <Text size="xs" c="dimmed">
              Updating…
            </Text>
          )}
          <PeriodSelect value={period} onChange={setPeriod} />
        </Group>
      </Group>

      <Card>
        <Stack gap="sm">
          <Text fw={600} size="sm">
            Log time
          </Text>
          <LogTimeForm
            workItem={{
              id: objectId ?? '',
              // The live name, read a moment ago — so each log refreshes the copy stored on entries.
              //
              // `||` rather than `??`, because an empty label is the case that matters: the stored
              // copy is a `required` attribute, and writing '' to it fails the create with a raw
              // validation message instead of logging the time.
              label: workItem.label || 'Untitled',
              typeId: workItem.typeId,
            }}
            onLogged={reload}
          />
        </Stack>
      </Card>

      <TimeReport
        filter={filter}
        periodLabel={periodSummary(period, dateFromIso(today))}
        currentUserId={user.id}
        reloadKey={key}
      />
    </Stack>
  )
}
