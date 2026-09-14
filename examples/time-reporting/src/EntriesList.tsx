import { ObjectTable } from '@starhive/ui'
import { Text } from '@mantine/core'

import { ATTR, ATTR_NAME, startOfWeekIso, sumHours, TIME_ENTRY_KEY } from './timeEntry'

/**
 * Time entries logged this week.
 *
 * Filtering is a StarQL predicate, so the host runs it against the search index and returns the rows
 * that match — rather than fetching everything and filtering in the browser. Remount with a `key` to
 * refetch after logging.
 */
export function EntriesList({ workItemId }: { workItemId?: string }) {
  // StarQL matches on display names (it queries the search index), while the columns below are
  // named by manifest key — see ATTR / ATTR_NAME.
  const thisWeek = `"${ATTR_NAME.date}" >= "${startOfWeekIso()}"`
  const where = workItemId
    ? `${thisWeek} and "${ATTR_NAME.workItem}" = objectId("${workItemId}")`
    : thisWeek

  return (
    <ObjectTable
      typeKey={TIME_ENTRY_KEY}
      attributes={[ATTR.date, ATTR.hours, ...(workItemId ? [] : [ATTR.workItem]), ATTR.notes]}
      where={where}
      limit={100}
      empty="No time logged this week."
      footer={(entries, columns) => (
        <Text size="sm" c="dimmed">
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'} ·{' '}
          {sumHours(entries, columns)}h this week
        </Text>
      )}
    />
  )
}
