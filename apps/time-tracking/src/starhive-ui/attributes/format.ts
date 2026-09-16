import dayjs from 'dayjs'
import localizedFormat from 'dayjs/plugin/localizedFormat'

import type { AttributeConfigurationView, NumberFormatterType } from './model'

// platform-ui extends this at its entry point (`src/index.tsx`); a package that also runs inside an
// app iframe cannot assume anyone did it, and `extend` is idempotent.
dayjs.extend(localizedFormat)

/**
 * Unit abbreviations the product offers for a `UNIT`-formatted number.
 *
 * Ported from platform-ui's `getNumberFormattingTypesValue`. Kept as a plain map rather than
 * translated: these are symbols, and they are the same in every locale the product ships.
 */
const UNIT_ABBREVIATIONS: Record<string, string> = {
  meter: 'm',
  centimeter: 'cm',
  millimeter: 'mm',
  kilometer: 'km',
  inch: 'in',
  foot: 'ft',
  yard: 'yd',
  mile: 'mi',
  gram: 'g',
  kilogram: 'kg',
  pound: 'lb',
  ounce: 'oz',
  liter: 'l',
  milliliter: 'ml',
  second: 's',
  minute: 'min',
  hour: 'h',
  day: 'd',
  byte: 'B',
  kilobyte: 'kB',
  megabyte: 'MB',
  gigabyte: 'GB',
  terabyte: 'TB',
  celsius: '°C',
  fahrenheit: '°F',
  percent: '%',
}

/**
 * The locale the product formats numbers in.
 *
 * Hardcoded, matching platform-ui's `utils/formatting.ts`. It is deliberately NOT the viewer's
 * locale: a shared renderer whose output drifted from the product's would defeat the point of
 * sharing it. When the product grows a real user locale, this is the single place to thread it.
 */
const NUMBER_LOCALE = 'en-US'

/**
 * Format a numeric attribute value the way the product does.
 *
 * Falls back to the raw string on anything unparseable rather than throwing — a value that came off
 * the wire is not guaranteed to be a number, and a cell that reads `3.x` beats a blank page.
 */
export function formatNumber(
  value: string,
  isInteger: boolean,
  numberFormatterType: NumberFormatterType = 'NONE',
  numberFormatterValue?: string,
): string {
  if (value === '') return value

  // An integer keeps its commas as typed; a decimal treats them as the separator they are elsewhere.
  const normalized = isInteger ? value : value.replace(/,/g, '.')
  const style = isInteger
    ? { minimumFractionDigits: 0, maximumFractionDigits: 0, useGrouping: true }
    : // Number loses precision past 15 significant digits, so do not promise more.
      { minimumFractionDigits: 1, maximumFractionDigits: 15, useGrouping: true }

  try {
    switch (numberFormatterType) {
      case 'CURRENCY':
        return new Intl.NumberFormat(NUMBER_LOCALE, {
          ...style,
          style: 'currency',
          currency: numberFormatterValue,
          currencyDisplay: 'symbol',
        }).format(Number(normalized))

      case 'PERCENTAGE':
        // 'percentage-multiplied': the stored value is a fraction (0.25 → 25%), which Intl's
        // `percent` style both scales and suffixes. Otherwise the value is already a percentage.
        return numberFormatterValue === 'percentage-multiplied'
          ? new Intl.NumberFormat(NUMBER_LOCALE, { ...style, style: 'percent' }).format(
              Number(normalized),
            )
          : `${new Intl.NumberFormat(NUMBER_LOCALE, { ...style, style: 'decimal' }).format(
              Number(normalized),
            )}%`

      case 'UNIT': {
        const formatted = new Intl.NumberFormat(NUMBER_LOCALE, {
          ...style,
          style: 'decimal',
        }).format(Number(normalized))
        const abbreviation = numberFormatterValue
          ? UNIT_ABBREVIATIONS[numberFormatterValue]
          : undefined
        return abbreviation ? `${formatted} ${abbreviation}` : formatted
      }

      default:
        return new Intl.NumberFormat(NUMBER_LOCALE, style).format(Number(normalized))
    }
  } catch {
    return value
  }
}

/** Format a numeric value from its attribute's own configuration. */
export function formatNumberFor(
  value: string,
  isInteger: boolean,
  configuration: AttributeConfigurationView | undefined,
): string {
  return formatNumber(
    value,
    isInteger,
    configuration?.numberFormatterType,
    configuration?.numberFormatterValue,
  )
}

/** `ll` / `LL` — the product's short and long date formats. */
export function formatDate(value: string, options?: { short?: boolean }): string {
  const parsed = dayjs(value)
  if (!parsed.isValid()) return value
  return parsed.format(options?.short ? 'll' : 'LL')
}

export function formatDateTime(value: string, options?: { short?: boolean }): string {
  const parsed = dayjs(value)
  if (!parsed.isValid()) return value
  return parsed.format(options?.short ? 'll LTS' : 'LL LTS')
}

/**
 * The two ends of a DATE_RANGE (`"<from>/<to>"`), raw and formatted.
 *
 * Both halves are returned rather than a joined string so a renderer can wrap each end in its own
 * `<time>` element — which is what the product does, and what keeps the range machine-readable.
 *
 * A half-open or malformed range still yields the half it has: the value is whatever was stored, and
 * a range is not worth losing because its other end is missing.
 */
export function splitDateRange(
  value: string,
  dateRangeType: 'DATE' | 'DATE_TIME' = 'DATE',
): { from: string; to: string; formattedFrom: string; formattedTo: string } {
  const [from = '', to = ''] = value.split('/')
  // Short format on both ends: a range is long enough already, and it is what the product uses.
  const format = (date: string) =>
    date ? (dateRangeType === 'DATE' ? formatDate : formatDateTime)(date, { short: true }) : ''
  return { from, to, formattedFrom: format(from), formattedTo: format(to) }
}

/** The same range as one string, for a caller with nowhere to put two `<time>` elements. */
export function formatDateRange(
  value: string,
  dateRangeType: 'DATE' | 'DATE_TIME' = 'DATE',
): string {
  const { formattedFrom, formattedTo } = splitDateRange(value, dateRangeType)
  if (!formattedFrom && !formattedTo) return value
  if (!formattedTo) return formattedFrom
  if (!formattedFrom) return formattedTo
  return `${formattedFrom} - ${formattedTo}`
}

/** Human file size for a MEDIA value, in the product's units. */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return ''
  if (bytes < 1024) return `${bytes} B`
  const units = ['kB', 'MB', 'GB', 'TB']
  let size = bytes / 1024
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit += 1
  }
  return `${size.toFixed(size >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`
}
