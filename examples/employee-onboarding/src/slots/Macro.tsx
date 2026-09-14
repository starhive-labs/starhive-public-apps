import { Group, Stack, Text } from '@mantine/core'
import { rawValueOf, useAutoResize, useStarhiveContext } from '@starhive/bridge'
import { ObjectTable } from '@starhive/ui'

import { ATTR, ATTR_NAME, doneCount, STATUS_WORKFLOW_KEY, TASK_KEY } from '../onboarding'

/**
 * The macro's arguments, as the writer answered them on insert. Keys match `params[].key` in the
 * manifest; everything arrives as it was stored, so read defensively — a page written against an
 * older version of the app may carry params this version no longer declares, or miss ones it does.
 */
type MacroParams = {
  hire?: string
  status?: string
  interactive?: boolean
}

function readParams(raw: Record<string, unknown> | undefined): MacroParams {
  return {
    hire: typeof raw?.hire === 'string' ? raw.hire.trim() : undefined,
    status: typeof raw?.status === 'string' ? raw.status.trim() : undefined,
    interactive: raw?.interactive !== false,
  }
}

/**
 * The onboarding checklist as a block inside somebody's page.
 *
 * A macro is read far more often than it is written, so this stores nothing: the page holds the
 * question (which hire, which status) and every reader gets today's answer, filtered by what they
 * are allowed to see.
 *
 * Two things a macro must do that other slots don't:
 *
 * 1. **Report its height.** The host cannot know how tall a block in prose should be — the manifest's
 *    `height` only holds the space until the first paint. `useAutoResize` reports the real content
 *    height on every change, so the block grows with the checklist instead of scrolling inside itself.
 * 2. **Respect its params.** `context.macroParams` is per *block*, not per install: the same module
 *    appears twice on a page saying two different things.
 */
export function Macro() {
  const { macroParams, stateKeyToId } = useStarhiveContext()
  const ref = useAutoResize<HTMLDivElement>()
  const params = readParams(macroParams)

  // The writer picks a status by its manifest key; the stored value is a provisioned state id, and
  // `stateKeyToId` is what maps between them.
  const wantedStateId = params.status
    ? stateKeyToId[`${STATUS_WORKFLOW_KEY}.${params.status}`]
    : undefined

  return (
    // The measured element: its height is what the host gives the block.
    <div ref={ref} style={{ padding: '0.75rem 0' }}>
      <Stack gap="xs">
        <Text fw={600} size="sm">
          {params.hire ? `Onboarding · ${params.hire}` : 'Onboarding checklist'}
        </Text>

        <ObjectTable
          typeKey={TASK_KEY}
          attributes={[ATTR.title, ATTR.status, ...(params.hire ? [] : [ATTR.newHire])]}
          // The hire is a free-text param, so it is matched on the reference's label — StarQL reads
          // display names, which is also why ATTR_NAME exists.
          where={params.hire ? `"${ATTR_NAME.newHire}" ~ "${params.hire}"` : undefined}
          limit={200}
          // A state *key* is not something StarQL can say, so this one narrows the page instead.
          filter={
            wantedStateId
              ? (task, columns) => {
                  const status = columns.find((column) => column.key === ATTR.status)
                  return status ? rawValueOf(task, status.id) === wantedStateId : true
                }
              : undefined
          }
          editable={params.interactive ? [ATTR.status] : []}
          empty="Nothing matches this checklist."
          footer={(tasks, columns) => (
            <Group justify="flex-end">
              <Text size="sm" c="dimmed">
                {doneCount(tasks, columns)}/{tasks.length} done
              </Text>
            </Group>
          )}
        />
      </Stack>
    </div>
  )
}
