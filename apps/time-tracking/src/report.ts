/**
 * The arithmetic behind every summary the app shows: total, per person, per work item, per month.
 *
 * Pure functions over a plain `Entry` record, so they can be run by `npm test` without a bridge or
 * a DOM. Turning a `BridgeObject` into an `Entry` happens in `useTimeEntries`, which is the one place
 * that knows attribute ids.
 */
import { type DateRange, monthKey, monthKeysBetween, monthLabel, previousDayIso } from './timeEntry'

export type Entry = {
  id: string
  /** `YYYY-MM-DD`. */
  date: string
  hours: number
  user: { id: string; name: string }
  /**
   * What the time was spent on. `label` is the name the object had when the entry was written, not
   * necessarily the one it has now — there is no reference for the host to resolve, so this is the
   * app's own copy. Grouping is by `id`, which never goes stale.
   */
  workItem: { id: string; label: string; typeId?: string }
  description?: string
}

/** One slice of a breakdown: who or what, how much, and how much of the whole that is. */
export type Share = {
  key: string
  label: string
  hours: number
  count: number
  /** 0–1, of the total across every slice. 0 when there is nothing at all. */
  share: number
}

export type MonthBucket = {
  /** `YYYY-MM`. */
  key: string
  /** `Sep 2026`. */
  label: string
  hours: number
  count: number
}

export function totalHours(entries: Entry[]): number {
  return entries.reduce((sum, entry) => sum + entry.hours, 0)
}

/**
 * What a row is called when the name is missing.
 *
 * Shared with `toEntry`, which is where a row acquires one, because `shares` below has to recognise
 * a fallback to be able to replace it. It used to test the label against the group's key instead,
 * which was true while the key was the name — and silently stopped being true once a work item was
 * keyed by its uuid, leaving a group stuck on "Unknown work item" even though a later entry knew it.
 */
export const UNKNOWN_USER = 'Unknown user'
export const UNKNOWN_WORK_ITEM = 'Unknown work item'

function shares(
  entries: Entry[],
  keyOf: (entry: Entry) => string,
  labelOf: (entry: Entry) => string,
  unknown: string,
): Share[] {
  const total = totalHours(entries)
  const byKey = new Map<string, Share>()
  for (const entry of entries) {
    const key = keyOf(entry)
    const label = labelOf(entry)
    const current = byKey.get(key) ?? { key, label, hours: 0, count: 0, share: 0 }
    current.hours += entry.hours
    current.count += 1
    // The first label seen might be the fallback; prefer any real name that turns up later.
    //
    // Only a fallback is replaced, never one real name by another — entries arrive newest first, so
    // for a work item renamed since some of its time was logged, the first real name seen is the
    // most recent one, and each later entry carries the name it had back then.
    if (current.label === unknown && label !== unknown) current.label = label
    byKey.set(key, current)
  }
  return [...byKey.values()]
    .map((slice) => ({ ...slice, share: total > 0 ? slice.hours / total : 0 }))
    .sort((a, b) => b.hours - a.hours || a.label.localeCompare(b.label))
}

/** Hours per person, most first. */
export function byPerson(entries: Entry[]): Share[] {
  return shares(
    entries,
    (entry) => entry.user.id,
    (entry) => entry.user.name,
    UNKNOWN_USER,
  )
}

/** Hours per work item, most first. */
export function byWorkItem(entries: Entry[]): Share[] {
  return shares(
    entries,
    (entry) => entry.workItem.id,
    (entry) => entry.workItem.label,
    UNKNOWN_WORK_ITEM,
  )
}

/**
 * Hours per calendar month, oldest first, with the empty months in between filled in — a chart
 * that skips July because nobody logged anything in July is a chart that lies about August.
 *
 * The span is the range asked for, where it is bounded; otherwise from the earliest entry to the
 * month of `now`. An unbounded range with no entries is an empty list.
 */
export function byMonth(
  entries: Entry[],
  range: DateRange = {},
  now: Date = new Date(),
): MonthBucket[] {
  const hoursByMonth = new Map<string, MonthBucket>()
  for (const entry of entries) {
    const key = monthKey(entry.date)
    const bucket = hoursByMonth.get(key) ?? { key, label: monthLabel(key), hours: 0, count: 0 }
    bucket.hours += entry.hours
    bucket.count += 1
    hoursByMonth.set(key, bucket)
  }

  const entryKeys = [...hoursByMonth.keys()].sort()
  const first = range.from ? monthKey(range.from) : entryKeys[0]
  // `to` is exclusive, so a range ending on the 1st ends in the month before.
  const last = range.to ? monthKey(previousDayIso(range.to)) : monthKey(localMonthOf(now))
  if (!first || !last || first > last) return []

  return monthKeysBetween(first, last).map(
    (key) => hoursByMonth.get(key) ?? { key, label: monthLabel(key), hours: 0, count: 0 },
  )
}

function localMonthOf(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

/** The people who logged anything, by id. */
export function distinctPeople(entries: Entry[]): number {
  return new Set(entries.map((entry) => entry.user.id)).size
}
