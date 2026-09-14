import { Stack, Text } from '@mantine/core'
import { ObjectTable } from '@starhive/ui'

import { ATTR, doneCount, TASK_KEY } from '../onboarding'

/**
 * The onboarding checklist as a dashboard widget.
 *
 * Read-only and compact: a widget is glanced at, not worked in, so status shows as a badge rather
 * than a menu.
 */
export function Widget() {
  return (
    <Stack gap="xs" p="sm">
      <Text fw={600} size="sm">
        Onboarding
      </Text>
      <ObjectTable
        typeKey={TASK_KEY}
        attributes={[ATTR.title, ATTR.status]}
        limit={50}
        empty="No tasks yet."
        footer={(tasks, columns) => (
          <Text size="sm" c="dimmed">
            {doneCount(tasks, columns)}/{tasks.length} done
          </Text>
        )}
      />
    </Stack>
  )
}
