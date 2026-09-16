import type { AttributeValueView, AttributeView } from '../model'

/** The first value's string, or `''` — what a single-value input binds to. */
export function firstValue(values: AttributeValueView[]): string {
  return values[0]?.value ?? ''
}

/** Every value's string, for a multi-value control. */
export function allValues(values: AttributeValueView[]): string[] {
  return values.map((value) => value.value)
}

/**
 * The label to put on a field: the caller's, else the attribute's name, else none.
 *
 * `label={false}` is how a table cell asks for a bare control — a label above every cell would be the
 * column header repeated on every row.
 */
export function labelFor(
  attribute: AttributeView,
  label: string | false | undefined,
): string | undefined {
  if (label === false) return undefined
  return label ?? attribute.name
}
