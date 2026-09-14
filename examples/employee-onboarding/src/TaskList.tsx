import { Text } from '@mantine/core'
import { ObjectTable } from '@starhive/ui'

import { ATTR, ATTR_NAME, doneCount, TASK_KEY } from './onboarding'

/**
 * Onboarding tasks, with an editable status.
 *
 * When a `newHireId` is given (the objectPanel slot) the list is filtered to that new hire
 * server-side and the column is dropped, since it would be the same on every row. Remount with a
 * `key` to refetch after adding.
 */
export function TaskList({ newHireId }: { newHireId?: string }) {
  return (
    <ObjectTable
      typeKey={TASK_KEY}
      attributes={[
        ATTR.title,
        ATTR.status,
        ATTR.dueDate,
        ...(newHireId ? [] : [ATTR.newHire]),
      ]}
      // StarQL matches on display names — see ATTR / ATTR_NAME in onboarding.ts.
      where={newHireId ? `"${ATTR_NAME.newHire}" = objectId("${newHireId}")` : undefined}
      limit={200}
      editable={[ATTR.status]}
      empty="No tasks yet."
      footer={(tasks, columns) => (
        <Text size="sm" c="dimmed">
          {doneCount(tasks, columns)}/{tasks.length} done
        </Text>
      )}
    />
  )
}
