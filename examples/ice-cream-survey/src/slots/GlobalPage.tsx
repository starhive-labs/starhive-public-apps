import { Stack, Text, Title } from '@mantine/core'
import { Card } from '@starhive/ui'

import { RateForm } from '../RateForm'
import { ResponsesList } from '../ResponsesList'
import { useReloadAfterIndex } from '../useReloadAfterIndex'

export function GlobalPage() {
  const { key, pending, reload } = useReloadAfterIndex()
  return (
    <Stack gap="md" p="lg">
      <Title order={3}>Ice Cream Survey</Title>
      <Card>
        <Stack gap="sm">
          <Text fw={600}>Leave a rating</Text>
          <RateForm onSubmitted={reload} />
        </Stack>
      </Card>
      <Card>
        <Stack gap="sm">
          <Text fw={600}>All ratings</Text>
          {pending && (
            <Text size="sm" c="dimmed">
              Updating…
            </Text>
          )}
          <ResponsesList key={key} />
        </Stack>
      </Card>
    </Stack>
  )
}
