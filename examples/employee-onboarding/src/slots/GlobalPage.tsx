import { Stack, Text, Title } from '@mantine/core'
import { Card } from '@starhive/ui'

import { CustomerSystem } from '../CustomerSystem'
import { PublicHolidays } from '../PublicHolidays'
import { TaskForm } from '../TaskForm'
import { TaskList } from '../TaskList'
import { useReloadAfterIndex } from '../useReloadAfterIndex'

export function GlobalPage() {
  const { key, pending, reload } = useReloadAfterIndex()
  return (
    <Stack gap="md" p="lg">
      <Title order={3}>Employee Onboarding</Title>
      <Card>
        <Stack gap="sm">
          <Text fw={600}>Add task</Text>
          <TaskForm onAdded={reload} />
        </Stack>
      </Card>
      <PublicHolidays />
      <CustomerSystem />
      <Card>
        <Stack gap="sm">
          <Text fw={600}>Onboarding tasks</Text>
          {pending && (
            <Text size="sm" c="dimmed">
              Updating…
            </Text>
          )}
          <TaskList key={key} />
        </Stack>
      </Card>
    </Stack>
  )
}
