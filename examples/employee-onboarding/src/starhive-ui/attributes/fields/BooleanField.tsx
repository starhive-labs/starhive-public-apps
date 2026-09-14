import { Checkbox } from '@mantine/core'

import { booleanFieldValues } from '../fieldKind'
import { firstValue, labelFor } from './shared'
import type { FieldProps } from './types'

/**
 * A true/false field.
 *
 * Unchecking writes `"false"`, not "no value": a BOOLEAN that has been answered "no" is a different
 * fact from one nobody has answered, and clearing it would lose that.
 */
export function BooleanField({ attribute, values, onChange, disabled, error, label }: FieldProps) {
  const checked = firstValue(values) === 'true'
  const text = labelFor(attribute, label)

  return (
    <Checkbox
      label={text}
      checked={checked}
      disabled={disabled}
      error={error}
      onChange={(event) => onChange(booleanFieldValues(event.currentTarget.checked))}
    />
  )
}
