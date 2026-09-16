import {
  AttributeField,
  AttributeSlotsProvider,
  type AttributeSlots,
  type AttributeValueView,
  type AttributeView,
  valuesOf,
} from '@starhive/attributes'
import { useObjects, useToast } from '@starhive/bridge'
import type { BridgeObject } from '@starhive/bridge'
import { useMemo, useState } from 'react'

import { useObjectCandidates } from './objectCandidates'
import { WorkflowControl } from './WorkflowControl'

export type ObjectFieldProps = {
  /** The object being edited — one of **this app's**. */
  object: BridgeObject
  attribute: AttributeView
  /** The type key whose objects a `REFERENCE` may point at, so its candidates can be listed. */
  referenceTypeKey?: string
  label?: string | false
  disabled?: boolean
  /** Called after a successful write, with the object the API returned. */
  onSaved?: (object: BridgeObject) => void
}

/**
 * One editable attribute of one object, which saves itself.
 *
 * The write-side counterpart of `<ObjectAttribute>`: it fetches whatever candidates the field needs,
 * calls `objects.update` on change, and reports a violation as a toast — the API's own message, which
 * names the constraint (`TRANSITION_CONDITION_NOT_MET`, a uniqueness clash) rather than "something
 * went wrong".
 *
 * ```tsx
 * <ObjectField object={task} attribute={dueDate} />
 * ```
 */
export function ObjectField({
  object,
  attribute,
  referenceTypeKey,
  label,
  disabled,
  onSaved,
}: ObjectFieldProps) {
  const objects = useObjects()
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  // The values shown while a save is in flight and until the caller re-reads.
  const [local, setLocal] = useState<AttributeValueView[] | null>(null)

  const candidates = useFieldCandidates(attribute, referenceTypeKey)
  const values = local ?? valuesOf(object, attribute.id)

  const slots = useMemo<AttributeSlots>(
    () => ({
      // A workflow move is not a field edit — it needs the object and its available transitions.
      renderWorkflowField: ({ attribute: workflowAttribute, values: current }) => (
        <WorkflowControl
          objectId={object.id}
          attribute={workflowAttribute}
          value={current[0]}
          onMoved={() => onSaved?.(object)}
        />
      ),
    }),
    [object, onSaved],
  )

  return (
    <AttributeSlotsProvider slots={slots}>
      <AttributeField
        attribute={attribute}
        values={values}
        label={label}
        disabled={disabled || saving}
        error={error}
        options={candidates.options}
        optionsLoading={candidates.isLoading}
        onChange={async (next, options) => {
          // Show it immediately; a field that snaps back while the request is in flight feels broken.
          setLocal(next.map((value, index) => ({ value, valueId: `local-${index}` })))
          setError(undefined)
          setSaving(true)
          try {
            const saved = await objects.update(
              object.id,
              [{ attributeId: attribute.id, values: next }],
              options,
            )
            setLocal(null)
            onSaved?.(saved)
          } catch (caught) {
            // Put it back to what the object actually says, and show why.
            setLocal(null)
            const message = caught instanceof Error ? caught.message : 'Could not save'
            setError(message)
            toast(message, 'error')
          } finally {
            setSaving(false)
          }
        }}
      />
    </AttributeSlotsProvider>
  )
}

/**
 * `OPTION` needs no candidates — its choices are on the attribute. `USER` needs none either, for a
 * reason worth stating plainly: the bridge has no user-directory method, so there is nothing to list.
 * A `USER` field keeps whatever the object already has.
 */
function useFieldCandidates(attribute: AttributeView, referenceTypeKey: string | undefined) {
  return useObjectCandidates(referenceTypeKey, attribute.attributeTypeCode === 'REFERENCE')
}
