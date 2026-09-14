import { Stack, Text } from '@mantine/core'
import { ObjectTable } from '@starhive/ui'

import { ATTR, ATTR_NAME, startOfWeekIso, sumHours, TIME_ENTRY_KEY } from '../timeEntry'

/**
 * Time logged this week, as a dashboard widget.
 *
 * Read-only and compact: a widget is glanced at, not worked in.
 */
export function Widget() {
  return (
    <Stack gap="xs" p="sm">
      <Text fw={600} size="sm">
        This week
      </Text>
      <ObjectTable
        typeKey={TIME_ENTRY_KEY}
        attributes={[ATTR.date, ATTR.hours]}
        where={`"${ATTR_NAME.date}" >= "${startOfWeekIso()}"`}
        limit={50}
        empty="No time logged this week."
        footer={(entries, columns) => (
          <Text size="sm" c="dimmed">
            {sumHours(entries, columns)}h this week
          </Text>
        )}
      />
    </Stack>
  )
}
