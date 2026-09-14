import { type BridgeAttribute, type BridgeObject, rawValueOf } from '@starhive/bridge'

/** Logical type key the app's manifest provisions for time entries. */
export const TIME_ENTRY_KEY = 'timeEntry'

/** Logical type key of the default "Work Item" type the app provisions. */
export const WORK_ITEM_KEY = 'workItem'

/**
 * The manifest's attribute **keys** — the stable handle for addressing an attribute.
 *
 * Use these anywhere an attribute is named to the SDK (`<ObjectTable attributes>`, `useAttribute`).
 * A key survives an admin renaming the attribute; a display name does not.
 */
export const ATTR = {
  date: 'date',
  hours: 'hours',
  workItem: 'workItem',
  notes: 'notes',
} as const

/**
 * The same attributes' **display names**.
 *
 * StarQL matches on the display name, not the key, because it queries the search index — so a filter
 * needs these even though everything else uses `ATTR`. A rename therefore still breaks a query; that
 * is a limitation of StarQL, not of the addressing.
 */
export const ATTR_NAME = {
  date: 'Date',
  hours: 'Hours',
  workItem: 'Work Item',
  notes: 'Notes',
} as const

export type TimeReportingConfig = {
  /** The Starhive typeId the `workItem` reference targets (defaults to the app's own work item type). */
  workItemType: string | null
  /** Rounding increment in minutes (e.g. 15). 0 = no rounding. */
  roundingMinutes: number
}

export const DEFAULT_CONFIG: TimeReportingConfig = { workItemType: null, roundingMinutes: 0 }

export function readConfig(raw: Record<string, unknown> | undefined): TimeReportingConfig {
  return {
    workItemType:
      typeof raw?.workItemType === 'string' ? raw.workItemType : DEFAULT_CONFIG.workItemType,
    roundingMinutes:
      typeof raw?.roundingMinutes === 'number' ? raw.roundingMinutes : DEFAULT_CONFIG.roundingMinutes,
  }
}

/** Round hours to the configured increment. */
export function roundHours(hours: number, roundingMinutes: number): number {
  if (!roundingMinutes) return hours
  const increment = roundingMinutes / 60
  return Math.round(hours / increment) * increment
}

export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

/**
 * Default value for the label attribute (`Notes`, the type's `labelAttribute`) when the user leaves
 * it blank — every object needs a non-empty label, e.g. "Timelog 2026-06-21 14:30".
 */
export function defaultTimeEntryLabel(now: Date = new Date()): string {
  return `Timelog ${now.toISOString().slice(0, 16).replace('T', ' ')}`
}

/** Monday (ISO) of the week containing `now`, as YYYY-MM-DD. */
export function startOfWeekIso(now: Date = new Date()): string {
  const date = new Date(now)
  const day = (date.getDay() + 6) % 7 // 0 = Monday
  date.setDate(date.getDate() - day)
  return date.toISOString().slice(0, 10)
}

/**
 * Total hours across some entries.
 *
 * Takes the resolved columns (what `<ObjectTable>` hands its footer) rather than a type schema, and
 * reads the raw value — `rawValueOf` gives the stored string, where `displayOf` would give the
 * formatted one and `Number('1,234.5')` is `NaN`.
 */
export function sumHours(objects: BridgeObject[], columns: BridgeAttribute[]): number {
  const hours = columns.find((column) => column.key === ATTR.hours)
  if (!hours) return 0
  return objects.reduce((total, object) => {
    const value = Number(rawValueOf(object, hours.id))
    return total + (Number.isFinite(value) ? value : 0)
  }, 0)
}

/** The 1st of the month containing `now`, as YYYY-MM-DD. */
export function startOfMonthIso(now: Date = new Date()): string {
  return `${now.toISOString().slice(0, 7)}-01`
}

/** The periods the `time-summary` macro offers (manifest → `modules.macro[].params`, key `period`). */
export type SummaryPeriod = 'week' | 'month' | 'all'

const PERIOD_STARTS: Record<SummaryPeriod, (now: Date) => string> = {
  week: startOfWeekIso,
  month: startOfMonthIso,
  // Every real date sorts after the empty string, so "all" needs no lower bound.
  all: () => '',
}

export const PERIOD_LABEL: Record<SummaryPeriod, string> = {
  week: 'This week',
  month: 'This month',
  all: 'All time',
}

/** Earliest date (inclusive) a `period` covers, as YYYY-MM-DD; `''` for `all`. */
export function periodStartIso(period: SummaryPeriod, now: Date = new Date()): string {
  return PERIOD_STARTS[period](now)
}

/** The writer's answers to the `time-summary` macro's params. */
export type TimeSummaryParams = {
  period: SummaryPeriod
  /** Case-insensitive match on the work item's label; empty means every work item. */
  workItem: string
}

export const DEFAULT_SUMMARY_PARAMS: TimeSummaryParams = { period: 'week', workItem: '' }

/**
 * Read `context.macroParams` — the answers stored on the document node when the macro was inserted.
 *
 * Nothing in there is guaranteed to have the type the manifest declared: the block outlives the
 * version of the app that wrote it, and a page can be copied anywhere. A macro with unreadable
 * params still renders, at the manifest's defaults, rather than the page losing a block.
 */
export function readMacroParams(raw: Record<string, unknown> | undefined): TimeSummaryParams {
  const period = raw?.period
  return {
    period:
      period === 'week' || period === 'month' || period === 'all'
        ? period
        : DEFAULT_SUMMARY_PARAMS.period,
    workItem:
      typeof raw?.workItem === 'string' ? raw.workItem.trim() : DEFAULT_SUMMARY_PARAMS.workItem,
  }
}
