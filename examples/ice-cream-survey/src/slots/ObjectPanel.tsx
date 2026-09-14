import { Stack, Text, Title } from '@mantine/core'
import { useConfig, useObjects, useStarhiveContext } from '@starhive/bridge'
import { Card } from '@starhive/ui'
import { useEffect, useState } from 'react'

import { RateForm } from '../RateForm'
import { ResponsesList } from '../ResponsesList'
import { FLAVOR_KEY, readConfig } from '../survey'
import { useReloadAfterIndex } from '../useReloadAfterIndex'

/**
 * Mounted inside an object's detail view; collects feedback on the current object — but only when
 * that object's type is the configured "Flavor" type (the `flavor` reference targets it). On any
 * other type there's nothing meaningful to rate, so it shows "Not available on this object".
 */
export function ObjectPanel() {
  const { objectId, typeKeyToId } = useStarhiveContext()
  const { config } = useConfig()
  const objects = useObjects()
  const { key, pending, reload } = useReloadAfterIndex()
  const [status, setStatus] = useState<'loading' | 'ok' | 'unavailable'>('loading')

  const flavorTypeId = readConfig(config).flavorType ?? typeKeyToId[FLAVOR_KEY] ?? ''

  useEffect(() => {
    if (!objectId) {
      setStatus('unavailable')
      return
    }
    let active = true
    setStatus('loading')
    // get() rejects for objects outside the app's scope; treat that (and a type mismatch) as N/A.
    objects.get(objectId).then(
      (object) => active && setStatus(object.typeId === flavorTypeId ? 'ok' : 'unavailable'),
      () => active && setStatus('unavailable'),
    )
    return () => {
      active = false
    }
  }, [objectId, objects, flavorTypeId])

  if (status === 'loading') {
    return (
      <Stack gap="md" p="lg">
        <Title order={3}>Feedback</Title>
        <Text size="sm" c="dimmed">
          Loading…
        </Text>
      </Stack>
    )
  }

  if (status === 'unavailable') {
    return (
      <Stack gap="md" p="lg">
        <Title order={3}>Feedback</Title>
        <Text size="sm" c="dimmed">
          Not available on this object.
        </Text>
      </Stack>
    )
  }

  return (
    <Stack gap="md" p="lg">
      <Title order={3}>Rate this flavor</Title>
      <Card>
        <Stack gap="sm">
          <Text fw={600}>Quick rating</Text>
          <RateForm flavorId={objectId} onSubmitted={reload} />
        </Stack>
      </Card>
      <Card>
        <Stack gap="sm">
          <Text fw={600}>Ratings for this flavor</Text>
          {pending && (
            <Text size="sm" c="dimmed">
              Updating…
            </Text>
          )}
          <ResponsesList key={key} flavorId={objectId} />
        </Stack>
      </Card>
    </Stack>
  )
}
