import { type BridgeObject, rawValueOf } from '@starhive/bridge'

/** Logical type key the app's manifest provisions for survey responses. */
export const RESPONSE_KEY = 'response'

/** Logical type key of the default "Flavor" type the app provisions. */
export const FLAVOR_KEY = 'flavor'

/**
 * The manifest's stable attribute **keys** on the provisioned `response` type.
 *
 * A key is identity; a display name is a string an admin may rename. Everything that addresses an
 * attribute — the form's fields, the table's columns — uses these.
 */
export const ATTR = {
  flavor: 'flavor',
  rating: 'rating',
  comment: 'comment',
  respondent: 'respondent',
  date: 'date',
} as const

/**
 * The same attributes' **display names**.
 *
 * StarQL matches on the display name, not the key, because it queries the search index — so a filter
 * has to use these while everything else uses [ATTR].
 */
export const ATTR_NAME = {
  flavor: 'Flavor',
  rating: 'Rating',
  comment: 'Comment',
  respondent: 'Respondent',
  date: 'Date',
} as const

export type IceCreamSurveyConfig = {
  /** The Starhive typeId the `flavor` reference targets (defaults to the app's own flavor type). */
  flavorType: string | null
  /** Number of stars on the rating scale (e.g. 5). */
  maxRating: number
}

export const DEFAULT_CONFIG: IceCreamSurveyConfig = { flavorType: null, maxRating: 5 }

export function readConfig(raw: Record<string, unknown> | undefined): IceCreamSurveyConfig {
  const maxRating =
    typeof raw?.maxRating === 'number' && raw.maxRating > 0
      ? raw.maxRating
      : DEFAULT_CONFIG.maxRating
  return {
    flavorType: typeof raw?.flavorType === 'string' ? raw.flavorType : DEFAULT_CONFIG.flavorType,
    maxRating,
  }
}

/** Clamp a star rating into the valid 1..max range (whole stars). */
export function clampRating(rating: number, maxRating: number): number {
  if (!Number.isFinite(rating)) return 0
  return Math.max(0, Math.min(maxRating, Math.round(rating)))
}

export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

/**
 * Default value for the label attribute (`comment`, the type's `labelAttribute`) when the user
 * leaves it blank — every object needs a non-empty label, e.g. "Rating 2026-06-25 14:30".
 */
export function defaultResponseLabel(now: Date = new Date()): string {
  return `Rating ${now.toISOString().slice(0, 16).replace('T', ' ')}`
}

/**
 * Average rating across responses (0 when there are none).
 *
 * Takes the rating attribute's id rather than the type: every caller already resolved the columns it
 * needs, and a whole type schema is more than an average requires.
 */
export function averageRating(objects: BridgeObject[], ratingAttributeId: string): number {
  if (objects.length === 0) return 0
  const sum = objects.reduce((total, object) => {
    const value = Number(rawValueOf(object, ratingAttributeId) ?? '0')
    return total + (Number.isFinite(value) ? value : 0)
  }, 0)
  return sum / objects.length
}
