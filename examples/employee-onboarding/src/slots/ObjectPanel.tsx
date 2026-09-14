import { Stack, Text, Title } from '@mantine/core'
import { useConfig, useObjects, useStarhiveContext } from '@starhive/bridge'
import { Card } from '@starhive/ui'
import { useEffect, useState } from 'react'

import { NEW_HIRE_KEY, readConfig } from '../onboarding'
import { TaskForm } from '../TaskForm'
import { TaskList } from '../TaskList'
import { useReloadAfterIndex } from '../useReloadAfterIndex'

/**
 * Mounted inside an object's detail view; manages onboarding tasks for the current object — but only
 * when that object's type is the configured "New hire" type (the `newHire` reference targets it). On
 * any other type there's nothing to onboard, so it shows "Not available on this object".
 */
export function ObjectPanel() {
  const { objectId, typeKeyToId } = useStarhiveContext()
  const { config } = useConfig()
  const objects = useObjects()
  const { key, pending, reload } = useReloadAfterIndex()
  const [status, setStatus] = useState<'loading' | 'ok' | 'unavailable'>('loading')

  const newHireTypeId = readConfig(config).newHireType ?? typeKeyToId[NEW_HIRE_KEY] ?? ''

  useEffect(() => {
    if (!objectId) {
      setStatus('unavailable')
      return
    }
    let active = true
    setStatus('loading')
    // get() rejects for objects outside the app's scope; treat that (and a type mismatch) as N/A.
    objects.get(objectId).then(
      (object) => active && setStatus(object.typeId === newHireTypeId ? 'ok' : 'unavailable'),
      () => active && setStatus('unavailable'),
    )
    return () => {
      active = false
    }
  }, [objectId, objects, newHireTypeId])

  if (status === 'loading') {
    return (
      <Stack gap="md" p="lg">
        <Title order={3}>Onboarding</Title>
        <Text size="sm" c="dimmed">
          Loading…
        </Text>
      </Stack>
    )
  }

  if (status === 'unavailable') {
    return (
      <Stack gap="md" p="lg">
        <Title order={3}>Onboarding</Title>
        <Text size="sm" c="dimmed">
          Not available on this object.
        </Text>
      </Stack>
    )
  }

  return (
    <Stack gap="md" p="lg">
      <Title order={3}>Onboarding</Title>
      <Card>
        <Stack gap="sm">
          <Text fw={600}>Add task</Text>
          <TaskForm newHireId={objectId} onAdded={reload} />
        </Stack>
      </Card>
      <Card>
        <Stack gap="sm">
          <Text fw={600}>Tasks for this hire</Text>
          {pending && (
            <Text size="sm" c="dimmed">
              Updating…
            </Text>
          )}
          <TaskList key={key} newHireId={objectId} />
        </Stack>
      </Card>
    </Stack>
  )
}
