import { Group } from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { Select } from '@starhive/ui'

import {
  dateFromIso,
  formatRange,
  localDateIso,
  type Period,
  PERIOD_LABEL,
  type PeriodChoice,
  PERIODS,
  periodRange,
  previousDayIso,
} from './timeEntry'

/**
 * The one period control, so every screen offers the same periods in the same words.
 *
 * Picking **Custom range** reveals a two-ended date picker beside the dropdown. It is seeded with the
 * dates of whichever preset was showing, so the range starts at something real and gets adjusted,
 * rather than opening empty and reporting on nothing until both ends are filled in.
 *
 * The dates here are **inclusive** at both ends, which is what the picker shows and what somebody
 * choosing "the 1st to the 30th" means. `rangeFor` is where that becomes the half-open range every
 * query wants.
 */
export function PeriodSelect({
  value,
  onChange,
  disabled,
}: {
  value: PeriodChoice
  onChange: (choice: PeriodChoice) => void
  disabled?: boolean
}) {
  function pick(period: Period) {
    if (period !== 'custom') return onChange({ period })

    // Seeded from what was on screen a moment ago. `periodRange` gives a half-open range, so its end
    // is the day after the last one included — step back to the day a person would expect to see.
    const seed = periodRange(value.period === 'custom' ? 'month' : value.period)
    onChange({
      period: 'custom',
      from: value.from ?? seed.from,
      to: value.to ?? (seed.to ? previousDayIso(seed.to) : undefined),
    })
  }

  return (
    <Group gap="xs" wrap="wrap" justify="flex-end">
      <Select
        aria-label="Period"
        data={PERIODS.map((period) => ({ value: period, label: PERIOD_LABEL[period] }))}
        value={value.period}
        onChange={(next) => next && pick(next as Period)}
        allowDeselect={false}
        disabled={disabled}
        w={150}
        size="xs"
      />
      {value.period === 'custom' && (
        <DatePickerInput
          type="range"
          aria-label="Custom range"
          placeholder="Pick two days"
          value={[
            value.from ? dateFromIso(value.from) : null,
            value.to ? dateFromIso(value.to) : null,
          ]}
          onChange={([from, to]) =>
            onChange({
              period: 'custom',
              from: from ? localDateIso(from) : undefined,
              to: to ? localDateIso(to) : undefined,
            })
          }
          // One day is a legitimate range — "what did we do on Monday" — and without this the picker
          // makes you click the same date twice and still refuses it.
          allowSingleDateInRange
          valueFormat="ll"
          disabled={disabled}
          size="xs"
          w={230}
        />
      )}
    </Group>
  )
}

/**
 * What the period is called in a stat tile: `this month`, or the two dates for a custom range.
 *
 * Lower case for the presets because it reads as the tail of a sentence there ("Logged · this
 * month"); a date needs no such help.
 */
export function periodSummary(choice: PeriodChoice, now: Date = new Date()): string {
  if (choice.period !== 'custom') return PERIOD_LABEL[choice.period].toLowerCase()
  return formatRange(choice.from, choice.to, now)
}
