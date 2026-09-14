import { Stack, Text, Title } from '@mantine/core'
import { useConfig, useObjects, useStarhiveContext } from '@starhive/bridge'
import { Card } from '@starhive/ui'
import { useEffect, useState } from 'react'

import { EntriesList } from '../EntriesList'
import { LogTimeForm } from '../LogTimeForm'
import { readConfig, WORK_ITEM_KEY } from '../timeEntry'
import { useReloadAfterIndex } from '../useReloadAfterIndex'

/**
 * Mounted inside an object's detail view; logs against the current object — but only when that
 * object's type is the configured "Work Item" type (the `workItem` reference targets it). On any
 * other type there's nothing meaningful to log, so it shows "Not available on this object".
 */
export function ObjectPanel() {
  const { objectId, typeKeyToId } = useStarhiveContext()
  const { config } = useConfig()
  const objects = useObjects()
  const { key, pending, reload } = useReloadAfterIndex()
  const [status, setStatus] = useState<'loading' | 'ok' | 'unavailable'>('loading')

  const workItemTypeId = readConfig(config).workItemType ?? typeKeyToId[WORK_ITEM_KEY] ?? ''

  useEffect(() => {
    if (!objectId) {
      setStatus('unavailable')
      return
    }
    let active = true
    setStatus('loading')
    // get() rejects for objects outside the app's scope; treat that (and a type mismatch) as N/A.
    objects.get(objectId).then(
      (object) => active && setStatus(object.typeId === workItemTypeId ? 'ok' : 'unavailable'),
      () => active && setStatus('unavailable'),
    )
    return () => {
      active = false
    }
  }, [objectId, objects, workItemTypeId])

  if (status === 'loading') {
    return (
      <Stack gap="md" p="lg">
        <Title order={3}>Time</Title>
        <Text size="sm" c="dimmed">
          Loading…
        </Text>
      </Stack>
    )
  }

  if (status === 'unavailable') {
    return (
      <Stack gap="md" p="lg">
        <Title order={3}>Time</Title>
        <Text size="sm" c="dimmed">
          Not available on this object.
        </Text>
      </Stack>
    )
  }

  return (
    <Stack gap="md" p="lg">
      <Title order={3}>Time on this item</Title>
      <Card>
        <Stack gap="sm">
          <Text fw={600}>Quick log</Text>
          <LogTimeForm workItemId={objectId} onLogged={reload} />
        </Stack>
      </Card>
      <Card>
        <Stack gap="sm">
          <Text fw={600}>Logged here</Text>
          {pending && (
            <Text size="sm" c="dimmed">
              Updating…
            </Text>
          )}
          <EntriesList key={key} workItemId={objectId} />
        </Stack>
      </Card>
    </Stack>
  )
}
