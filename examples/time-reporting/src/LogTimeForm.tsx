import { ObjectForm } from '@starhive/ui'
import { useConfig, useStarhiveContext } from '@starhive/bridge'

import {
  ATTR,
  defaultTimeEntryLabel,
  readConfig,
  roundHours,
  TIME_ENTRY_KEY,
  todayIso,
  WORK_ITEM_KEY,
} from './timeEntry'

/**
 * Log time against a work item.
 *
 * `<ObjectForm>` draws a field per attribute and calls `objects.create`; what stays here is the part
 * that is actually about time reporting — rounding to the configured increment, and the fallback
 * label. Neither is something a form could guess, which is what `beforeSubmit` is for.
 *
 * When `workItemId` is given (the objectPanel slot) the reference is fixed to it.
 */
export function LogTimeForm({
  workItemId,
  onLogged,
}: {
  workItemId?: string
  onLogged?: () => void
}) {
  const { typeKeyToId } = useStarhiveContext()
  const { config } = useConfig()
  const { roundingMinutes, workItemType } = readConfig(config)

  // Object queries are scoped to the app's own types, so candidates can only be listed when the
  // reference still points at the type this app provisioned. An admin who re-pointed it in settings
  // gets a field with no candidate list rather than a wrong one.
  const usesOwnWorkItemType = !workItemType || workItemType === typeKeyToId[WORK_ITEM_KEY]

  return (
    <ObjectForm
      typeKey={TIME_ENTRY_KEY}
      attributes={[ATTR.hours, ATTR.date, ATTR.workItem, ATTR.notes]}
      referenceTypes={usesOwnWorkItemType ? { [ATTR.workItem]: WORK_ITEM_KEY } : undefined}
      initial={{
        [ATTR.date]: [todayIso()],
        ...(workItemId ? { [ATTR.workItem]: [workItemId] } : {}),
      }}
      readOnly={workItemId ? [ATTR.workItem] : undefined}
      submitLabel="Log time"
      onCreated={onLogged}
      beforeSubmit={(draft, fields) => {
        const field = (key: string) => fields.find((one) => one.key === key)
        const hoursField = field(ATTR.hours)
        const notesField = field(ATTR.notes)
        if (!hoursField || !notesField) return 'The Time Entry type is missing an attribute'

        const hours = Number(draft[hoursField.id]?.[0])
        if (!Number.isFinite(hours) || hours <= 0) return 'Enter a positive number of hours'

        return fields
          .map((one) => {
            if (one.id === hoursField.id) {
              return { attributeId: one.id, values: [String(roundHours(hours, roundingMinutes))] }
            }
            // `Notes` is the type's label attribute, so it must always have a value.
            if (one.id === notesField.id) {
              const notes = draft[one.id]?.[0]?.trim()
              return { attributeId: one.id, values: [notes || defaultTimeEntryLabel()] }
            }
            return { attributeId: one.id, values: draft[one.id] ?? [] }
          })
          .filter((attribute) => attribute.values.length > 0)
      }}
    />
  )
}
