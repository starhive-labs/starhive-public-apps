import { Text } from '@mantine/core'
import type { ReactNode } from 'react'

import { AttributeValue } from './AttributeValue'
import { BooleanField } from './fields/BooleanField'
import { ChoiceField } from './fields/ChoiceField'
import { DateField } from './fields/DateField'
import { NumberField } from './fields/NumberField'
import { TextField } from './fields/TextField'
import type { ChoiceOption, FieldChange, FieldProps } from './fields/types'
import { FIELD_KIND_LABEL, type FieldKind, fieldKindFor } from './fieldKind'
import type { AttributeValueView, AttributeView, Density } from './model'
import { useAttributeSlots } from './slots'

/**
 * The {@link FieldKind}s this package has a control for.
 *
 * A kind it does not implement renders **read-only** rather than offering an input that would write a
 * value the API refuses. Which kinds those are is a property of *this* host, not of the data model —
 * platform-ui implements `media`, `location`, `dateRange`, `rating` and `priority` with its own
 * controls, and shares the same `fieldKindFor` decision.
 */
const IMPLEMENTED_KINDS = new Set<FieldKind>([
  'text',
  'multilineText',
  'link',
  'number',
  'boolean',
  'date',
  'dateTime',
  'choice',
  'reference',
  'user',
  // Both go through a slot the host fills; without one they fall back to read-only.
  'richText',
  'workflow',
])

/** True when `<AttributeField>` will offer an input for this attribute rather than a read-only value. */
export function isEditable(attribute: AttributeView): boolean {
  return IMPLEMENTED_KINDS.has(fieldKindFor(attribute))
}

export type AttributeFieldProps = {
  attribute: AttributeView
  /** The object's current values. Empty for a new object. */
  values?: AttributeValueView[]
  /**
   * Called with the complete new value list, string-encoded — the shape `objects.update` takes.
   *
   * A `WORKFLOW` move also passes `{ transitions }`, because Starhive refuses a new state that does
   * not name the transition that reached it.
   */
  onChange: FieldChange
  /** Candidates for `REFERENCE` and `USER`. `OPTION` needs none — its choices are on the attribute. */
  options?: ChoiceOption[]
  optionsLoading?: boolean
  onSearch?: (query: string) => void
  disabled?: boolean
  error?: string
  label?: string | false
  density?: Density
}

/**
 * An editable attribute.
 *
 * The write-side counterpart of {@link AttributeValue}, and pure in the same way: it renders a
 * control and reports a value. It does not fetch, does not save, and is **not a form framework** —
 * validation, submission and error text stay with the caller, which is the only party that knows what
 * the API said.
 *
 * `onChange` gives the complete value list as strings, which is exactly what
 * `bridge.objects.update` / `objects.create` take and what platform-ui's `useAttributeHandler`
 * already produces. So the adapter on either side is a single line.
 *
 * ```tsx
 * <AttributeField
 *   attribute={attribute}
 *   values={values}
 *   onChange={(next) => setDraft((d) => ({ ...d, [attribute.id]: next }))}
 * />
 * ```
 *
 * **An attribute it cannot edit renders read-only.** Offering an input that writes a value the API
 * would refuse is worse than showing the value: `CALCULATED` and `SEQUENCE` are derived, `SLA` and
 * `COMPLETENESS` are computed, `MEDIA` needs an upload, `LOCATION` needs a geocoder.
 */
export function AttributeField(props: AttributeFieldProps): ReactNode {
  const {
    attribute,
    values = [],
    onChange,
    options,
    optionsLoading,
    onSearch,
    disabled,
    error,
    label,
    density = 'default',
  } = props
  const slots = useAttributeSlots()

  const fieldProps: FieldProps = {
    attribute,
    values,
    onChange,
    options,
    optionsLoading,
    onSearch,
    disabled,
    error,
    label,
    density,
  }

  // Switches on the shared kind, not on the raw type code, so this dispatcher and the product's
  // inline editors cannot disagree about which control an attribute wants.
  switch (fieldKindFor(attribute)) {
    case 'text':
    case 'multilineText':
    case 'link':
      return <TextField {...fieldProps} />

    case 'number':
      return <NumberField {...fieldProps} />

    case 'boolean':
      return <BooleanField {...fieldProps} />

    case 'date':
    case 'dateTime':
      return <DateField {...fieldProps} />

    case 'choice':
    case 'reference':
    case 'user':
      return <ChoiceField {...fieldProps} />

    case 'richText': {
      // A textarea would overwrite a formatted document with plain text on the first keystroke, so a
      // host with a real editor has to say so. Without one the value stays read-only.
      const slotted = slots.renderRichTextField?.({ attribute, values, onChange, disabled })
      if (slotted !== undefined && slotted !== null) return slotted
      return <ReadOnly {...props} reason="Rich text needs the editor this app has not provided" />
    }

    case 'workflow': {
      // Not a field edit: a move depends on the object's current state and on conditions that can
      // involve the current user, so it needs the object and a transitions call. The host supplies a
      // control (`<WorkflowControl>` in `@starhive/ui`).
      const slotted = slots.renderWorkflowField?.({ attribute, values, onChange, disabled })
      if (slotted !== undefined && slotted !== null) return slotted
      return <ReadOnly {...props} reason="Changing status needs a workflow control" />
    }

    // Kinds this package has no control for. Each is a real control somewhere — platform-ui draws
    // them — but an upload, a geocoder or a range picker is more than this package carries.
    case 'rating':
    case 'priority':
    case 'media':
    case 'location':
    case 'dateRange':
      return (
        <ReadOnly
          {...props}
          reason={`${FIELD_KIND_LABEL[fieldKindFor(attribute)]} is not editable in this SDK`}
        />
      )

    case 'readOnly':
    default:
      return <ReadOnly {...props} />
  }
}

/**
 * The value, drawn but not editable.
 *
 * Carries the reason in a `title` so a developer wiring a form can tell "this type is not editable"
 * from "my field did not render", instead of staring at a value that will not respond.
 */
function ReadOnly({
  attribute,
  values = [],
  label,
  density = 'default',
  reason,
}: AttributeFieldProps & { reason?: string }) {
  const text = label === false ? undefined : (label ?? attribute.name)
  return (
    <div title={reason ?? `${attribute.attributeTypeCode} values are not editable`}>
      {text ? (
        <Text component="div" size="sm" c="dimmed" mb={2}>
          {text}
        </Text>
      ) : null}
      <AttributeValue attribute={attribute} values={values} density={density} />
    </div>
  )
}
