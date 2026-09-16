import { TextInput, Textarea } from '@mantine/core'

import { fieldKindFor, textFieldValues } from '../fieldKind'
import { firstValue, labelFor } from './shared'
import type { FieldProps } from './types'

/**
 * A text field: a textarea where the value may span lines, a single-line input otherwise.
 *
 * `TEXT` is multi-line, matching the product — a `TEXT` value can contain newlines, so a single-line
 * input would quietly stop a user entering a value the API accepts. `EMAIL`, `URL` and `IP_ADDRESS`
 * are single-line by nature.
 */
export function TextField({ attribute, values, onChange, disabled, error, label }: FieldProps) {
  const kind = fieldKindFor(attribute)
  const value = firstValue(values)
  const multiline = kind === 'multilineText'
  const shared = {
    // A link kind gets the matching input type, so a browser validates and a phone offers the right
    // keyboard. The value is still a plain string either way.
    ...(kind === 'link' ? { type: attribute.attributeTypeCode === 'EMAIL' ? 'email' : 'url' } : {}),
    label: labelFor(attribute, label),
    withAsterisk: attribute.required,
    value,
    disabled,
    error,
    // `textFieldValues` decides what an emptied field means (no value, not an empty string) — shared
    // with the product's inline editors so the two cannot disagree.
    onChange: (event: { currentTarget: { value: string } }) =>
      onChange(textFieldValues(event.currentTarget.value)),
  }

  return multiline ? <Textarea autosize minRows={2} {...shared} /> : <TextInput {...shared} />
}
