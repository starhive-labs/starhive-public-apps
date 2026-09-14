import { DatePickerInput, DateTimePicker } from '@mantine/dates'
import dayjs from 'dayjs'

import { textFieldValues } from '../fieldKind'
import { firstValue, labelFor } from './shared'
import type { FieldProps } from './types'

/**
 * How the API stores each kind of date value, and therefore what the field must report.
 *
 * A `DATE` is a plain calendar day with no zone — formatting it through anything zone-aware can shift
 * it by a day near midnight, which is why this formats the picked date directly rather than going via
 * `toISOString()`.
 */
const DATE_FORMAT = 'YYYY-MM-DD'
const DATE_TIME_FORMAT = 'YYYY-MM-DDTHH:mm:ss'

/** What the picker shows. Matches the product's short date format (dayjs `ll`). */
const DISPLAY_DATE = 'll'
const DISPLAY_DATE_TIME = 'll LT'

/**
 * The stored string for a picked date, or no value when the picker was cleared.
 *
 * Formatted through dayjs in **local** time, never `toISOString()`. A `DATE` is a calendar day with
 * no zone: the picker hands back local midnight, and `toISOString()` on local midnight is the
 * *previous* day for anyone west of Greenwich. That off-by-one is the whole reason this is a named
 * function with its own tests.
 */
export function dateFieldValues(picked: Date | null | undefined, withTime: boolean): string[] {
  if (!picked) return []
  const parsed = dayjs(picked)
  if (!parsed.isValid()) return []
  return textFieldValues(parsed.format(withTime ? DATE_TIME_FORMAT : DATE_FORMAT))
}

/**
 * The `Date` a picker should show for a stored value.
 *
 * A stored value can be a plain day or a full instant — the read path produces both — and an
 * unparseable one becomes an empty picker rather than an invalid `Date` the control would choke on.
 */
export function dateFieldValue(stored: string): Date | null {
  if (!stored) return null
  const parsed = dayjs(stored)
  return parsed.isValid() ? parsed.toDate() : null
}

/**
 * A date field, using the same Mantine date components the product's own calendar is built on
 * (`@mantine/dates`), so it inherits the workspace's theme and reads like a Starhive date picker
 * rather than a browser one.
 *
 * It is not the product's `@/ui/Calendar` component itself — that is 684 lines wired into the app's
 * i18n, notifications and inline-edit chrome. This is the same underlying picker with the same
 * theme, which is what makes it look right in an app.
 */
export function DateField({ attribute, values, onChange, disabled, error, label }: FieldProps) {
  const withTime = attribute.attributeTypeCode === 'DATETIME'
  const value = dateFieldValue(firstValue(values))

  const shared = {
    label: labelFor(attribute, label),
    withAsterisk: attribute.required,
    disabled,
    error,
    clearable: true,
    popoverProps: { withinPortal: true },
  }

  if (withTime) {
    return (
      <DateTimePicker
        {...shared}
        value={value}
        valueFormat={DISPLAY_DATE_TIME}
        onChange={(next) => onChange(dateFieldValues(next, true))}
      />
    )
  }

  return (
    <DatePickerInput
      {...shared}
      value={value}
      valueFormat={DISPLAY_DATE}
      onChange={(next) => onChange(dateFieldValues(next, false))}
    />
  )
}
