import { Stack, Text, Title } from '@mantine/core'
import { Card } from '@starhive/ui'

import { EntriesList } from '../EntriesList'
import { LogTimeForm } from '../LogTimeForm'
import { useReloadAfterIndex } from '../useReloadAfterIndex'

export function GlobalPage() {
  const { key, pending, reload } = useReloadAfterIndex()
  return (
    <Stack gap="md" p="lg">
      <Title order={3}>Time Reporting</Title>
      <Card>
        <Stack gap="sm">
          <Text fw={600}>Log time</Text>
          <LogTimeForm onLogged={reload} />
        </Stack>
      </Card>
      <Card>
        <Stack gap="sm">
          <Text fw={600}>This week</Text>
          {pending && (
            <Text size="sm" c="dimmed">
              Updating…
            </Text>
          )}
          <EntriesList key={key} />
        </Stack>
      </Card>
    </Stack>
  )
}
