import type { AttributeValueView, AttributeView, Density } from '../model'

/**
 * A field reporting a new value.
 *
 * Always the full list, string-encoded — the shape `objects.update` and `objects.create` take, and
 * the same shape platform-ui's `useAttributeHandler` already produces. A field that reported a diff,
 * or a parsed value, would make every caller convert.
 *
 * `transitions` is how a `WORKFLOW` move travels: Starhive refuses a new state that does not name the
 * transition that reached it, so the two go in one payload.
 */
export type FieldChange = (
  values: string[],
  options?: { transitions?: Record<string, string> },
) => void

/** One candidate for a choice field. */
export type ChoiceOption = {
  value: string
  label: string
  /** The candidate's own picture — an object's `SYSTEM_IMAGE`, a user's avatar. */
  avatarUrl?: string
  /**
   * Its type's icon, shown when it has no picture of its own.
   *
   * Every object of a type shares this, and it is what makes a reference read as a *thing* rather
   * than a string — the product shows it in every reference chip and picker row.
   */
  iconUrl?: string
  /** That icon's configured tint. */
  iconColor?: string
  disabled?: boolean
}

/** What every field primitive receives. */
export type FieldProps = {
  attribute: AttributeView
  /** The object's current values for this attribute. Empty when it has none. */
  values: AttributeValueView[]
  onChange: FieldChange
  /**
   * Candidates for `REFERENCE` and `USER`, which the host has to fetch — an app through
   * `useObjectQuery`, the product through react-query. `OPTION` needs none: its choices are on the
   * attribute's own configuration.
   */
  options?: ChoiceOption[]
  optionsLoading?: boolean
  /** Text to search candidates by, when the host supports server-side search. */
  onSearch?: (query: string) => void
  disabled?: boolean
  /** A violation to show under the field — the host's, since only it knows what the API said. */
  error?: string
  /** Field label. `false` for a bare control, which is what a table cell wants. */
  label?: string | false
  density?: Density
}
