import { Group, Stack, Text } from '@mantine/core'
import { useAutoResize, useStarhiveContext } from '@starhive/bridge'
import { ObjectTable } from '@starhive/ui'
import { useMemo } from 'react'

import {
  ATTR,
  ATTR_NAME,
  PERIOD_LABEL,
  periodStartIso,
  readMacroParams,
  sumHours,
  TIME_ENTRY_KEY,
} from '../timeEntry'

/**
 * The `time-summary` macro: hours logged in a period, as one block in someone's page.
 *
 * Two things make this slot different from the others:
 *
 * 1. **It has arguments.** `context.macroParams` holds what the writer answered in the insert dialog
 *    the host drew from `manifest.yaml` → `modules.macro[].params`. The same module inserted twice on
 *    one page gets different params, so everything here is derived from them and nothing is stored.
 * 2. **It has no size.** A macro sits in prose, so the host has no height to give it — `useAutoResize`
 *    reports what we actually drew (clamped host-side to 40–2000 px). Until then the block holds the
 *    manifest's `height`. The call is a no-op in every other slot.
 *
 * The page stores the question, never the answer: every reader gets a fresh render, as themselves.
 */
export function MacroPage() {
  const { macroParams } = useStarhiveContext()
  const { period, workItem: workItemFilter } = useMemo(
    () => readMacroParams(macroParams),
    [macroParams],
  )
  const contentRef = useAutoResize<HTMLDivElement>()

  // Both halves are StarQL, so the host filters against the search index rather than this block
  // pulling every entry and sifting it. `~` is a contains match on the work item's label.
  const since = periodStartIso(period)
  const clauses = [
    ...(since ? [`"${ATTR_NAME.date}" >= "${since}"`] : []),
    ...(workItemFilter ? [`"${ATTR_NAME.workItem}" ~ "${workItemFilter}"`] : []),
  ]

  return (
    <div ref={contentRef} style={{ padding: '0.75rem 0' }}>
      <Stack gap="xs">
        <Text fw={600} size="sm">
          Time logged · {PERIOD_LABEL[period]}
          {workItemFilter ? ` · ${workItemFilter}` : ''}
        </Text>

        <ObjectTable
          typeKey={TIME_ENTRY_KEY}
          attributes={[ATTR.date, ATTR.hours, ATTR.workItem]}
          where={clauses.length > 0 ? clauses.join(' and ') : undefined}
          limit={200}
          empty="No time logged in this period."
          footer={(entries, columns) => (
            <Group justify="flex-end">
              <Text size="sm" c="dimmed">
                {sumHours(entries, columns)}h total
              </Text>
            </Group>
          )}
        />
      </Stack>
    </div>
  )
}
