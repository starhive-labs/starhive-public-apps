import {
  type BridgeAttribute,
  type BridgeObject,
  rawValueOf,
  useAttributes,
  useBridge,
  useObjectAggregate,
  valuesOf,
} from '@starhive/bridge'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { type Entry, UNKNOWN_USER, UNKNOWN_WORK_ITEM } from './report'
import { ATTR, ATTR_NAME, type EntryFilter, starqlFor, TIME_ENTRY_KEY, whereFor } from './timeEntry'

/** Rows per request. */
export const PAGE_SIZE = 200

/**
 * The most entries one screen will read for its breakdowns.
 *
 * A per-person split needs every row, and every row is a page through the index; five pages is a
 * few seconds on a slow connection and covers a year of a busy team's work on one object. Past it
 * the screen says so and the headline total — which is an index aggregate — stays exact anyway.
 */
export const MAX_ENTRIES = 1000

export type TimeEntries = {
  entries: Entry[]
  /** How many matched, whether or not they were all fetched. */
  total: number
  /** True when `entries` holds the first [MAX_ENTRIES] of more. */
  truncated: boolean
  isLoading: boolean
  error: Error | null
  /** Ask again — after a write this component made, once the index has had time to see it. */
  refetch: () => void
  /**
   * Drop an entry locally. A deleted entry stays in the index for a second or two, so a refetch
   * straight after `objects.remove` would show it again; forgetting it here keeps the screen honest
   * until the index catches up.
   */
  forget: (id: string) => void
}

type Columns = {
  workItemId?: BridgeAttribute
  workItemLabel?: BridgeAttribute
  workItemTypeId?: BridgeAttribute
  loggedBy?: BridgeAttribute
  date?: BridgeAttribute
  hours?: BridgeAttribute
  description?: BridgeAttribute
}

/**
 * One `BridgeObject` as the plain record the report functions work on.
 *
 * The person still arrives resolved — a USER value carries their name, because the host knows it —
 * but the work item does not: its id and its name are two text values this app wrote itself. The
 * name is therefore what it was when the time was logged. Reading the object back to refresh it
 * would be one request per distinct work item on every screen, which is what storing the name is
 * there to avoid; see README → "The name beside an entry".
 *
 * An entry with no readable hours or date is skipped rather than counted as zero; it would be a row
 * that lowers an average and explains nothing.
 */
export function toEntry(object: BridgeObject, columns: Columns): Entry | null {
  if (!columns.date || !columns.hours) return null
  const date = rawValueOf(object, columns.date.id)?.slice(0, 10)
  const hours = Number(rawValueOf(object, columns.hours.id))
  if (!date || !Number.isFinite(hours)) return null

  const [user] = columns.loggedBy ? valuesOf(object, columns.loggedBy.id) : []
  const workItemId = columns.workItemId ? rawValueOf(object, columns.workItemId.id) : undefined
  const workItemLabel = columns.workItemLabel
    ? rawValueOf(object, columns.workItemLabel.id)
    : undefined
  const description = columns.description
    ? rawValueOf(object, columns.description.id)?.trim()
    : undefined

  return {
    id: object.id,
    date,
    hours,
    user: {
      id: user?.user?.id ?? user?.value ?? '',
      name: user?.user?.name || user?.display || user?.user?.email || UNKNOWN_USER,
    },
    workItem: {
      id: workItemId ?? '',
      // Never the bare id: a report row headed by a uuid tells the reader nothing they can act on.
      label: workItemLabel?.trim() || UNKNOWN_WORK_ITEM,
      typeId: columns.workItemTypeId ? rawValueOf(object, columns.workItemTypeId.id) : undefined,
    },
    description: description || undefined,
  }
}

/**
 * Every entry a filter matches, up to [MAX_ENTRIES], as plain records.
 *
 * Paged rather than asked for in one request, because the index caps a page and a silent cap is a
 * per-person split that is quietly wrong for whoever logged last. `enabled: false` asks nothing —
 * for a panel that has not yet learned whether it applies to the object it is on.
 */
export function useTimeEntries(filter: EntryFilter, options?: { enabled?: boolean }): TimeEntries {
  const bridge = useBridge()
  const enabled = options?.enabled ?? true
  const columns = useAttributes(TIME_ENTRY_KEY, [
    ATTR.workItemId,
    ATTR.workItemLabel,
    ATTR.workItemTypeId,
    ATTR.loggedBy,
    ATTR.date,
    ATTR.hours,
    ATTR.description,
  ])
  const starql = starqlFor(filter)

  const [state, setState] = useState<{
    objects: BridgeObject[]
    total: number
    isLoading: boolean
    error: Error | null
  }>({ objects: [], total: 0, isLoading: enabled, error: null })
  const [reloadToken, setReloadToken] = useState(0)
  const [forgotten, setForgotten] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    if (!enabled) {
      setState({ objects: [], total: 0, isLoading: false, error: null })
      return
    }
    let active = true
    setState((previous) => ({ ...previous, isLoading: true, error: null }))
    setForgotten(new Set())

    async function load() {
      const objects: BridgeObject[] = []
      let total = 0
      let offset = 0
      for (;;) {
        const page = await bridge.objects.query(starql, {
          typeKey: TIME_ENTRY_KEY,
          offset,
          limit: PAGE_SIZE,
        })
        objects.push(...page.result)
        total = page.total
        offset += page.result.length
        if (page.isLast || page.result.length === 0 || offset >= MAX_ENTRIES) break
      }
      return { objects, total }
    }

    load().then(
      ({ objects, total }) => active && setState({ objects, total, isLoading: false, error: null }),
      (error: Error) => active && setState({ objects: [], total: 0, isLoading: false, error }),
    )
    return () => {
      active = false
    }
  }, [bridge, starql, enabled, reloadToken])

  const resolved = useMemo<Columns>(() => {
    const find = (key: string) => columns.data.find((column) => column.key === key)
    return {
      workItemId: find(ATTR.workItemId),
      workItemLabel: find(ATTR.workItemLabel),
      workItemTypeId: find(ATTR.workItemTypeId),
      loggedBy: find(ATTR.loggedBy),
      date: find(ATTR.date),
      hours: find(ATTR.hours),
      description: find(ATTR.description),
    }
  }, [columns.data])

  const entries = useMemo(
    () =>
      state.objects
        .filter((object) => !forgotten.has(object.id))
        .map((object) => toEntry(object, resolved))
        .filter((entry): entry is Entry => entry !== null),
    [state.objects, resolved, forgotten],
  )

  const refetch = useCallback(() => setReloadToken((token) => token + 1), [])
  const forget = useCallback(
    (id: string) => setForgotten((current) => new Set(current).add(id)),
    [],
  )

  return {
    entries,
    total: Math.max(0, state.total - forgotten.size),
    truncated: state.objects.length < state.total && state.objects.length >= MAX_ENTRIES,
    isLoading: state.isLoading || columns.isLoading,
    error: state.error ?? columns.error,
    refetch,
    forget,
  }
}

/**
 * The exact total for a filter, summed by the index.
 *
 * Kept beside the fetched entries rather than derived from them: the entries are capped, the
 * aggregate is not, so this is the one figure that stays right on an object with years of history.
 */
export function useTotalHours(
  filter: EntryFilter,
  options?: { enabled?: boolean },
): { hours: number | undefined; isLoading: boolean; refetch: () => void } {
  const enabled = options?.enabled ?? true
  const where = whereFor(filter)
  const { data, isLoading, refetch } = useObjectAggregate({
    typeKey: TIME_ENTRY_KEY,
    // An impossible predicate rather than a skipped request: the hook has no `enabled`, and an empty
    // filter here would sum the whole workspace for a panel that does not yet know what it is on.
    where: enabled ? where || undefined : `"${ATTR_NAME.date}" < "0001-01-01"`,
    operation: 'sum',
    attribute: ATTR.hours,
  })
  return {
    hours: enabled ? (data?.value ?? (data ? 0 : undefined)) : undefined,
    isLoading,
    refetch,
  }
}
