import { type BridgeAttribute, type BridgeObject, rawValueOf } from '@starhive/bridge'

/** Logical type key the app's manifest provisions for onboarding tasks. */
export const TASK_KEY = 'onboardingTask'

/** Logical type key of the default "New Hire" type the app provisions. */
export const NEW_HIRE_KEY = 'newHire'

/**
 * The manifest's attribute **keys** — the stable handle for addressing an attribute.
 *
 * Use these anywhere an attribute is named to the SDK. A key survives an admin renaming the
 * attribute; a display name does not.
 */
export const ATTR = {
  title: 'title',
  status: 'status',
  dueDate: 'dueDate',
  newHire: 'newHire',
  notes: 'notes',
} as const

/**
 * The same attributes' **display names**.
 *
 * StarQL matches on the display name, because it queries the search index — so a filter needs these
 * even though everything else uses `ATTR`.
 */
export const ATTR_NAME = {
  title: 'Title',
  status: 'Status',
  dueDate: 'Due date',
  newHire: 'New hire',
  notes: 'Notes',
} as const

/** Logical workflow key the manifest provisions for a task's status. */
export const STATUS_WORKFLOW_KEY = 'taskStatus'

/**
 * How many of these tasks are in an end state.
 *
 * Reads `isEndState` off the workflow's own states, which now ride on the attribute's schema — so
 * this no longer needs a hardcoded list of state keys, and a workspace that renamed "Done" or added
 * a fourth state still counts correctly.
 */
export function doneCount(objects: BridgeObject[], columns: BridgeAttribute[]): number {
  const status = columns.find((column) => column.key === ATTR.status)
  const endStates = new Set(
    (status?.configuration?.states ?? []).filter((state) => state.isEndState).map((s) => s.id),
  )
  if (!status || endStates.size === 0) return 0
  return objects.filter((object) => {
    const stateId = rawValueOf(object, status.id)
    return stateId !== undefined && endStates.has(stateId)
  }).length
}

export type OnboardingConfig = {
  /** The Starhive typeId the `newHire` reference targets (defaults to the app's own new-hire type). */
  newHireType: string | null
  /** Days from today used to pre-fill a new task's due date. */
  defaultDueDays: number
}

export const DEFAULT_CONFIG: OnboardingConfig = { newHireType: null, defaultDueDays: 7 }

export function readConfig(raw: Record<string, unknown> | undefined): OnboardingConfig {
  return {
    newHireType: typeof raw?.newHireType === 'string' ? raw.newHireType : DEFAULT_CONFIG.newHireType,
    defaultDueDays:
      typeof raw?.defaultDueDays === 'number' ? raw.defaultDueDays : DEFAULT_CONFIG.defaultDueDays,
  }
}

export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

/** Default due date: `defaultDueDays` from today, as YYYY-MM-DD. */
export function dueDateIso(defaultDueDays: number, now: Date = new Date()): string {
  const date = new Date(now)
  date.setDate(date.getDate() + (Number.isFinite(defaultDueDays) ? defaultDueDays : 0))
  return date.toISOString().slice(0, 10)
}

