import { TextInput } from '@mantine/core'

import { textFieldValues } from '../fieldKind'
import { firstValue, labelFor } from './shared'
import type { FieldProps } from './types'

/**
 * A number field.
 *
 * A native numeric `TextInput`, not Mantine's `NumberInput`: that one **parses** its value, so
 * `7.50` comes back as `7.5` and a value past 15 significant digits loses precision. The API's
 * encoding is a string, and a field whose job is to report one should not round-trip it through
 * `Number` on the way.
 */
export function NumberField({ attribute, values, onChange, disabled, error, label }: FieldProps) {
  const isInteger = attribute.attributeTypeCode === 'INTEGER'

  return (
    <TextInput
      type="number"
      inputMode={isInteger ? 'numeric' : 'decimal'}
      step={isInteger ? 1 : 'any'}
      label={labelFor(attribute, label)}
      withAsterisk={attribute.required}
      value={firstValue(values)}
      disabled={disabled}
      error={error}
      onChange={(event) => onChange(textFieldValues(event.currentTarget.value))}
    />
  )
}
