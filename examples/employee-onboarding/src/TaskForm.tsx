import { useConfig, useStarhiveContext } from '@starhive/bridge'
import { ObjectForm } from '@starhive/ui'

import { ATTR, dueDateIso, NEW_HIRE_KEY, readConfig, TASK_KEY } from './onboarding'

/**
 * Add an onboarding task.
 *
 * `<ObjectForm>` draws a field per attribute and calls `objects.create`; what stays here is the part
 * that is about onboarding — the default due date from the install's config, and fixing the new hire
 * when the form is shown beside one.
 */
export function TaskForm({
  newHireId,
  onAdded,
}: {
  newHireId?: string
  onAdded?: () => void
}) {
  const { typeKeyToId } = useStarhiveContext()
  const { config } = useConfig()
  const { defaultDueDays, newHireType } = readConfig(config)

  // Object queries are scoped to the app's own types, so candidates can only be listed while the
  // reference still points at the type this app provisioned.
  const usesOwnNewHireType = !newHireType || newHireType === typeKeyToId[NEW_HIRE_KEY]

  return (
    <ObjectForm
      typeKey={TASK_KEY}
      attributes={[ATTR.title, ATTR.dueDate, ATTR.newHire, ATTR.notes]}
      referenceTypes={usesOwnNewHireType ? { [ATTR.newHire]: NEW_HIRE_KEY } : undefined}
      initial={{
        [ATTR.dueDate]: [dueDateIso(defaultDueDays)],
        ...(newHireId ? { [ATTR.newHire]: [newHireId] } : {}),
      }}
      readOnly={newHireId ? [ATTR.newHire] : undefined}
      submitLabel="Add task"
      onCreated={onAdded}
    />
  )
}
