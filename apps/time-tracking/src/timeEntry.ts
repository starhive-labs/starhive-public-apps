/**
 * What a time entry is, in this app's own terms.
 *
 * Imports nothing, so `npm test` can compile and run it on its own — the duration parser and the
 * period arithmetic are exactly the kind of code that looks right and is quietly wrong at a month
 * boundary or for someone who types `1,5`.
 */

/** Logical type key the manifest provisions for time entries. */
export const TIME_ENTRY_KEY = 'timeEntry'

/** Logical type key of the default "Work Item" type the manifest provisions. */
export const WORK_ITEM_KEY = 'workItem'

/**
 * The manifest's attribute **keys** — the stable handle for addressing an attribute to the SDK.
 * A key survives an admin renaming the attribute; a display name does not.
 */
export const ATTR = {
  summary: 'summary',
  workItemId: 'workItemId',
  workItemLabel: 'workItemLabel',
  workItemTypeId: 'workItemTypeId',
  loggedBy: 'loggedBy',
  date: 'date',
  hours: 'hours',
  description: 'description',
} as const

/**
 * The same attributes' **display names**.
 *
 * StarQL matches on the display name, not the key, because it queries the search index — so every
 * `where` clause needs these even though everything else uses `ATTR`. Keep them in step with
 * `manifest.yaml`.
 */
export const ATTR_NAME = {
  summary: 'Summary',
  workItemId: 'Work item id',
  workItemLabel: 'Work item',
  workItemTypeId: 'Work item type id',
  loggedBy: 'Logged by',
  date: 'Date',
  hours: 'Hours',
  description: 'Description',
} as const

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export type TimeTrackingConfig = {
  /**
   * The Starhive typeIds time may be logged on — where the Time tab appears, and what the app may
   * read. Empty means nothing has been nominated yet, which the settings page is for.
   */
  workItemTypes: string[]
  /** Rounding increment in minutes. 0 = keep what was typed. */
  roundingMinutes: number
}

export const DEFAULT_CONFIG: TimeTrackingConfig = { workItemTypes: [], roundingMinutes: 0 }

/**
 * Read the install's settings.
 *
 * `workItemTypes` is a `multi` field, and a multi field is not always a list: the platform seeds a
 * manifest default as the single string it was declared as, and an admin who picks one type may
 * leave it that way. Both shapes mean the same thing, so both are read.
 */
export function readConfig(raw: Record<string, unknown> | undefined): TimeTrackingConfig {
  const rounding = raw?.roundingMinutes
  return {
    workItemTypes: asTypeIds(raw?.workItemTypes),
    roundingMinutes:
      typeof rounding === 'number' && Number.isFinite(rounding) && rounding >= 0
        ? rounding
        : DEFAULT_CONFIG.roundingMinutes,
  }
}

/** A config value that holds type ids, as a list — whether it arrived as one, as a string, or not at all. */
export function asTypeIds(value: unknown): string[] {
  const list = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value]
  return [
    ...new Set(
      list
        .filter((one): one is string => typeof one === 'string' && one.trim() !== '')
        .map((one) => one.trim()),
    ),
  ]
}

// ---------------------------------------------------------------------------
// Durations
// ---------------------------------------------------------------------------

/** The most a single entry may hold. Past this the number is a typo, not a working day. */
export const MAX_HOURS_PER_ENTRY = 24

/**
 * Hours from what a person typed, or null when it cannot be read.
 *
 * People write durations the way they think about them, and a form that only takes `1.5` makes
 * everyone do arithmetic. Accepted: `1.5`, `1,5`, `1:30`, `1h`, `1h 30m`, `1h30`, `90m`, `45 min`,
 * `2 hours`, `.5`. A bare number is hours. Zero and negatives are not durations.
 */
export function parseDuration(input: string): number | null {
  const text = input.trim().toLowerCase().replace(',', '.')
  if (!text) return null

  // h:mm
  const clock = /^(\d+):([0-5]?\d)$/.exec(text)
  if (clock) return positive(Number(clock[1]) + Number(clock[2]) / 60)

  // A bare number is hours.
  if (/^\d*\.?\d+$/.test(text)) return positive(Number(text))

  // Units, in any combination: "1h 30m", "1h30", "90m", "45 min", "2 hours", "1.5h".
  let hours = 0
  let matched = false
  // A unit ends where the letters end — `\b` would refuse `1h30m`, where a digit follows the `h`.
  const units = /(\d*\.?\d+)\s*(h(?:ours?|rs?)?|m(?:in(?:ute)?s?)?)(?![a-z])/g
  let rest = text
  for (const match of text.matchAll(units)) {
    matched = true
    const amount = Number(match[1])
    hours += match[2].startsWith('h') ? amount : amount / 60
    rest = rest.replace(match[0], '')
  }
  // "1h30" — a trailing bare number after an hours unit is minutes.
  const trailing = /^\s*(\d+)\s*$/.exec(rest)
  if (matched && trailing && /h/.test(text)) hours += Number(trailing[1]) / 60
  else if (rest.trim() !== '') return null

  return matched ? positive(hours) : null
}

function positive(hours: number): number | null {
  return Number.isFinite(hours) && hours > 0 ? hours : null
}

/** Round hours to the configured increment; 0 leaves them alone. Never rounds a real entry to 0. */
export function roundHours(hours: number, roundingMinutes: number): number {
  if (!roundingMinutes || roundingMinutes <= 0) return hours
  const increment = roundingMinutes / 60
  const rounded = Math.round(hours / increment) * increment
  return rounded > 0 ? rounded : increment
}

/**
 * Hours as people read them: `2h 30m`, `45m`, `8h`. Seconds are noise for a timesheet, so the
 * value is rounded to the minute first — `0.3333h` is `20m`, not `19m`.
 */
export function formatHours(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return '0h'
  const totalMinutes = Math.round(hours * 60)
  const wholeHours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (wholeHours === 0) return `${minutes}m`
  if (minutes === 0) return `${wholeHours}h`
  return `${wholeHours}h ${minutes}m`
}

/** Hours as a compact decimal for a table cell or an axis: `2.5`, `0.75`, `8`. */
export function formatDecimalHours(hours: number): string {
  if (!Number.isFinite(hours)) return '0'
  return String(Math.round(hours * 100) / 100)
}

/** The stored string for a DECIMAL value. Two decimals is a minute's precision, near enough. */
export function hoursToStored(hours: number): string {
  return (Math.round(hours * 100) / 100).toFixed(2)
}

// ---------------------------------------------------------------------------
// Dates and periods
// ---------------------------------------------------------------------------

/**
 * A calendar day as `YYYY-MM-DD`, in **local** time.
 *
 * Never `toISOString().slice(0, 10)`: that is UTC, and local midnight is the previous day for
 * anyone west of Greenwich — an entry logged "today" at 00:30 in New York would land on yesterday.
 */
export function localDateIso(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * A local `Date` at midnight on a `YYYY-MM-DD` day.
 *
 * Never `new Date(iso)`: that parses a bare date as **UTC** midnight, which is the previous day for
 * anyone west of Greenwich — the same off-by-one `localDateIso` exists to avoid, in the other
 * direction. An unreadable day falls back to now, since every caller wants a date to reckon from.
 */
export function dateFromIso(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return new Date()
  return new Date(year, month - 1, day)
}

/** `YYYY-MM` of a stored date. Works on a plain day and on a full instant alike. */
export function monthKey(dateIso: string): string {
  return dateIso.slice(0, 7)
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

/** `2026-09` → `Sep 2026`. */
export function monthLabel(key: string): string {
  const [year, month] = key.split('-')
  const index = Number(month) - 1
  return `${MONTH_NAMES[index] ?? month} ${year}`
}

/** The month after `YYYY-MM`, as `YYYY-MM`. */
export function nextMonthKey(key: string): string {
  const [year, month] = key.split('-').map(Number)
  const date = new Date(year, month, 1) // month is 1-based here, so this is already "next"
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** Every month from `from` to `to` inclusive, as `YYYY-MM` keys in order. */
export function monthKeysBetween(from: string, to: string): string[] {
  const keys: string[] = []
  let current = from
  // A bound of a few hundred keeps a garbage range from spinning forever.
  while (current <= to && keys.length < 600) {
    keys.push(current)
    current = nextMonthKey(current)
  }
  return keys
}

/** The reporting periods offered, everywhere a period is picked. */
export type Period = 'week' | 'month' | 'lastMonth' | 'quarter' | 'year' | 'all' | 'custom'

export const PERIODS: Period[] = [
  'week',
  'month',
  'lastMonth',
  'quarter',
  'year',
  'all',
  'custom',
]

export const PERIOD_LABEL: Record<Period, string> = {
  week: 'This week',
  month: 'This month',
  lastMonth: 'Last month',
  quarter: 'This quarter',
  year: 'This year',
  all: 'All time',
  custom: 'Custom range',
}

/**
 * A period as a screen holds it: one of the presets, or `custom` with the two days a person picked.
 *
 * The two days are **inclusive**, because that is what somebody choosing "the 1st to the 30th" means
 * and what the picker shows them. Everything downstream wants a half-open range instead, so the
 * conversion happens in exactly one place — see [rangeFor].
 */
export type PeriodChoice = {
  period: Period
  /** `custom` only: the first day, inclusive. */
  from?: string
  /** `custom` only: the last day, inclusive. */
  to?: string
}

/** A half-open range of calendar days: `from` inclusive, `to` exclusive, either side optional. */
export type DateRange = { from?: string; to?: string }

/** Where a period starts and ends, relative to `now`. Weeks start on Monday. */
export function periodRange(period: Period, now: Date = new Date()): DateRange {
  const year = now.getFullYear()
  const month = now.getMonth()
  switch (period) {
    case 'week': {
      const start = new Date(now)
      start.setDate(now.getDate() - ((now.getDay() + 6) % 7))
      const end = new Date(start)
      end.setDate(start.getDate() + 7)
      return { from: localDateIso(start), to: localDateIso(end) }
    }
    case 'month':
      return {
        from: localDateIso(new Date(year, month, 1)),
        to: localDateIso(new Date(year, month + 1, 1)),
      }
    case 'lastMonth':
      return {
        from: localDateIso(new Date(year, month - 1, 1)),
        to: localDateIso(new Date(year, month, 1)),
      }
    case 'quarter': {
      const quarterStart = month - (month % 3)
      return {
        from: localDateIso(new Date(year, quarterStart, 1)),
        to: localDateIso(new Date(year, quarterStart + 3, 1)),
      }
    }
    case 'year':
      return {
        from: localDateIso(new Date(year, 0, 1)),
        to: localDateIso(new Date(year + 1, 0, 1)),
      }
    case 'all':
      return {}
    // A custom period has no range of its own — its two days live on the choice, not on the period.
    // Asked anyway (a caller that only has the enum), it bounds nothing rather than guessing.
    case 'custom':
      return {}
  }
}

/** The day before `YYYY-MM-DD`, as `YYYY-MM-DD`. */
export function previousDayIso(dateIso: string): string {
  const date = dateFromIso(dateIso)
  date.setDate(date.getDate() - 1)
  return localDateIso(date)
}

/** The day after `YYYY-MM-DD`, as `YYYY-MM-DD`. */
export function nextDayIso(dateIso: string): string {
  const date = dateFromIso(dateIso)
  date.setDate(date.getDate() + 1)
  return localDateIso(date)
}

/**
 * The half-open range a choice covers — the one place an inclusive pair becomes an exclusive bound.
 *
 * Somebody who picks "the 1st to the 30th" means the 30th counted in, and the picker shows them both
 * of those days. Every query downstream wants `to` exclusive, so the last day is advanced by one.
 * Getting this wrong loses a whole day off the end of every custom report, silently and plausibly.
 *
 * A half-finished custom range bounds only the side that has been picked, so the report stays
 * readable while somebody is still choosing rather than emptying out.
 */
export function rangeFor(choice: PeriodChoice, now: Date = new Date()): DateRange {
  if (choice.period !== 'custom') return periodRange(choice.period, now)
  return {
    from: choice.from || undefined,
    to: choice.to ? nextDayIso(choice.to) : undefined,
  }
}

/** The day, month name and year of a `YYYY-MM-DD`. */
function dayParts(dateIso: string): { day: number; month: string; year: number } {
  const [year, month, day] = dateIso.split('-').map(Number)
  return { day, month: MONTH_NAMES[month - 1] ?? String(month), year }
}

/** A day as `16 Sep`, or `16 Sep 2025` when it is not in `now`'s year. */
export function formatDayShort(dateIso: string, now: Date = new Date()): string {
  const { day, month, year } = dayParts(dateIso)
  return year === now.getFullYear() ? `${day} ${month}` : `${day} ${month} ${year}`
}

/**
 * What a custom range is called on screen: `16 Sep – 20 Sep`.
 *
 * Short on purpose — it goes in a stat tile's label, where a pair of full dates wraps to three lines
 * in the object panel's narrow column. The year is shown on **both** ends or on neither, and only
 * dropped when the whole range sits in the current year: half a range carrying a year reads as
 * though the other half were a different one.
 */
export function formatRange(from?: string, to?: string, now: Date = new Date()): string {
  if (!from && !to) return 'any time'
  if (from && !to) return `${formatDayShort(from, now)} onwards`
  if (!from && to) return `up to ${formatDayShort(to, now)}`

  const start = dayParts(from as string)
  const end = dayParts(to as string)
  const thisYear = now.getFullYear()
  const bare = start.year === thisYear && end.year === thisYear
  const show = (part: { day: number; month: string; year: number }) =>
    bare ? `${part.day} ${part.month}` : `${part.day} ${part.month} ${part.year}`
  return `${show(start)} – ${show(end)}`
}

// ---------------------------------------------------------------------------
// StarQL
// ---------------------------------------------------------------------------

/** Escape a value for a double-quoted StarQL string. */
function quoted(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

/**
 * The object an entry is being written against, as the app needs it at write time.
 *
 * All three are stored: the id to find the entry by, the name so a report can say what the time went
 * on without reading the object back, and the type so an entry stays meaningful after its type is
 * dropped from the settings.
 */
export type LoggedAgainst = {
  id: string
  label: string
  typeId?: string
}

export type EntryFilter = {
  /** Only entries on this object. */
  workItemId?: string
  /** Only entries on objects of this type. */
  workItemTypeId?: string
  /** Only entries by this user. */
  userId?: string
  /** Only entries dated inside this range. */
  range?: DateRange
}

/**
 * The StarQL predicate for a filter, without `order by`, or `''` for no filter at all.
 *
 * Every half is a predicate the index evaluates, so a panel gets the ten rows that match rather
 * than every entry in the workspace to sift in the browser.
 *
 * The object is matched with **`==`, not `=`**. Its id lives in a TEXT attribute, and for TEXT the
 * two operators read different index fields: `=` goes through the analyzer, where a uuid is several
 * tokens and `1f74e980-…` matches anything sharing a segment, while `==` reads the untokenized
 * keyword field and matches the whole string. With a REFERENCE this did not arise — `objectId(…)`
 * was matched as an id — so it is the one thing that genuinely changed with the storage.
 */
export function whereFor(filter: EntryFilter): string {
  const clauses: string[] = []
  if (filter.workItemId) {
    clauses.push(`${quoted(ATTR_NAME.workItemId)} == ${quoted(filter.workItemId)}`)
  }
  if (filter.workItemTypeId) {
    clauses.push(`${quoted(ATTR_NAME.workItemTypeId)} == ${quoted(filter.workItemTypeId)}`)
  }
  if (filter.userId)
    clauses.push(`${quoted(ATTR_NAME.loggedBy)} = userId(${quoted(filter.userId)})`)
  if (filter.range?.from) clauses.push(`${quoted(ATTR_NAME.date)} >= ${quoted(filter.range.from)}`)
  if (filter.range?.to) clauses.push(`${quoted(ATTR_NAME.date)} < ${quoted(filter.range.to)}`)
  return clauses.join(' and ')
}

/** The full StarQL for a list: the predicate, then newest work first. */
export function starqlFor(filter: EntryFilter): string {
  const where = whereFor(filter)
  const order = `order by ${quoted(ATTR_NAME.date)} desc, Created desc`
  return where ? `${where} ${order}` : order
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

/**
 * The value of `summary`, the type's label attribute, so an entry reads sensibly wherever Starhive
 * lists it: the description when there is one, else "2h 30m · Jane Doe · 2026-09-15".
 */
export function entrySummary(input: {
  hours: number
  dateIso: string
  userName?: string
  description?: string
}): string {
  const description = input.description?.trim()
  if (description) return description.length > 120 ? `${description.slice(0, 117)}…` : description
  return [formatHours(input.hours), input.userName?.trim() || undefined, input.dateIso]
    .filter(Boolean)
    .join(' · ')
}
