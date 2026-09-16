import { Button, Stack, Text } from '@mantine/core'
import {
  AttributeField,
  type AttributeValueView,
  type AttributeView,
  isEditable,
} from '@starhive/attributes'
import { useAttributes, useObjects, useToast } from '@starhive/bridge'
import type { BridgeAttributeInput, BridgeObject } from '@starhive/bridge'
import { type ReactNode, useMemo, useState } from 'react'

import { useObjectCandidates } from './objectCandidates'

/** attributeId -> the values a field last reported. */
export type FormDraft = Record<string, string[]>

export type ObjectFormProps = {
  /** The manifest type key to create an object of. */
  typeKey: string
  /** Fields, by manifest attribute key (preferred) or display name, in the order given. */
  attributes: string[]
  /**
   * Type keys whose objects a `REFERENCE` field may offer, keyed by the reference's attribute key.
   * Without one, a reference field shows no candidates — only the app's own types are queryable.
   */
  referenceTypes?: Record<string, string>
  /** Starting values, by attribute key — a default date, a fixed reference on an objectPanel. */
  initial?: Record<string, string[]>
  /** Attribute keys to render but not let the user change (a reference fixed by the surface). */
  readOnly?: string[]
  submitLabel?: string
  /** Called with the created object. */
  onCreated?: (object: BridgeObject) => void
  /**
   * Last chance to adjust the payload — a computed label, a rounded number, a default the manifest
   * cannot express. Return the attributes to send, or a string to refuse with that message.
   */
  beforeSubmit?: (draft: FormDraft, attributes: AttributeView[]) => BridgeAttributeInput[] | string
  children?: ReactNode
}

/**
 * A form that creates one object of a type.
 *
 * Renders a field per attribute, collects what they report, and calls `objects.create`. Deliberately
 * thin: it does not validate beyond what the attributes declare, because only the app knows its own
 * rules — `beforeSubmit` is where those go, and where a computed label belongs.
 *
 * ```tsx
 * <ObjectForm
 *   typeKey="timeEntry"
 *   attributes={['date', 'hours', 'workItem', 'notes']}
 *   referenceTypes={{ workItem: 'workItem' }}
 *   initial={{ date: [todayIso()] }}
 *   submitLabel="Log time"
 * />
 * ```
 */
export function ObjectForm({
  typeKey,
  attributes,
  referenceTypes,
  initial,
  readOnly,
  submitLabel = 'Create',
  onCreated,
  beforeSubmit,
  children,
}: ObjectFormProps) {
  const fields = useAttributes(typeKey, attributes)
  const objects = useObjects()
  const toast = useToast()

  const [draft, setDraft] = useState<FormDraft>({})
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // `initial` is keyed by attribute key; the draft is keyed by attributeId, which needs the schema.
  const seeded = useMemo<FormDraft>(() => {
    const out: FormDraft = {}
    for (const field of fields.data) {
      const key = field.key ?? field.name
      const values = initial?.[key]
      if (values) out[field.id] = values
    }
    return out
  }, [fields.data, initial])

  const values = { ...seeded, ...draft }
  const readOnlyKeys = new Set(readOnly ?? [])

  if (fields.isLoading) {
    return (
      <Text size="sm" c="dimmed">
        Loading…
      </Text>
    )
  }
  if (fields.error) {
    return (
      <Text size="sm" c="negative.6">
        {fields.error.message}
      </Text>
    )
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()

    // Only what the attributes themselves declare. Anything else is the app's rule, not the form's.
    const missing = fields.data.filter(
      (field) => field.required && (values[field.id]?.length ?? 0) === 0,
    )
    if (missing.length > 0) {
      setErrors(Object.fromEntries(missing.map((field) => [field.id, 'Required'])))
      return
    }
    setErrors({})

    let payload: BridgeAttributeInput[] = fields.data
      .filter((field) => (values[field.id]?.length ?? 0) > 0)
      .map((field) => ({ attributeId: field.id, values: values[field.id] as string[] }))

    if (beforeSubmit) {
      const adjusted = beforeSubmit(values, fields.data)
      if (typeof adjusted === 'string') {
        toast(adjusted, 'error')
        return
      }
      payload = adjusted
    }

    setSubmitting(true)
    try {
      const created = await objects.create(typeKey, payload)
      setDraft({})
      onCreated?.(created)
    } catch (caught) {
      // The API's message names the violation, which is more use than "could not create".
      toast(caught instanceof Error ? caught.message : 'Could not create', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <Stack gap="md">
        {fields.missing.length > 0 && (
          <Text size="xs" c="warning.6">
            No such attribute: {fields.missing.join(', ')}
          </Text>
        )}
        {fields.data.map((field) => (
          <FormField
            key={field.id}
            field={field}
            values={values[field.id] ?? []}
            error={errors[field.id]}
            disabled={submitting || readOnlyKeys.has(field.key ?? field.name)}
            referenceTypeKey={referenceTypes?.[field.key ?? field.name]}
            onChange={(next) => setDraft((current) => ({ ...current, [field.id]: next }))}
          />
        ))}
        {children}
        <Button type="submit" loading={submitting}>
          {submitLabel}
        </Button>
      </Stack>
    </form>
  )
}

/**
 * One field of the form, with its candidates.
 *
 * A component rather than a loop body because each `REFERENCE` needs its own query, and a hook cannot
 * be called inside a map.
 */
function FormField({
  field,
  values,
  error,
  disabled,
  referenceTypeKey,
  onChange,
}: {
  field: AttributeView
  values: string[]
  error?: string
  disabled: boolean
  referenceTypeKey?: string
  onChange: (values: string[]) => void
}) {
  const candidates = useObjectCandidates(referenceTypeKey, field.attributeTypeCode === 'REFERENCE')

  // A draft holds plain strings; the field wants value views. There is no valueId yet — nothing has
  // been saved — so a positional one is enough to key the controls.
  const asValues: AttributeValueView[] = values.map((value, index) => ({
    value,
    valueId: `draft-${index}`,
  }))

  // Showing an uneditable type in a creation form would be a control nobody can fill in.
  if (!isEditable(field)) return null

  return (
    <AttributeField
      attribute={field}
      values={asValues}
      onChange={onChange}
      options={candidates.options}
      optionsLoading={candidates.isLoading}
      disabled={disabled}
      error={error}
    />
  )
}
