/**
 * The kind of control an attribute wants.
 *
 * **This is the shared decision, not a shared control.** "A `DATE_RANGE` wants a range picker", "a
 * `SEQUENCE` wants nothing because the server derives it" — those are facts about Starhive's data
 * model, and before this they were a 34-way switch duplicated in every editor. The *control* is the
 * host's: the product's inline editors are click-to-edit with confirm/cancel and per-attribute zod
 * validation, while an app's are plain form fields that save on change. Both are right for where they
 * live, and neither should dictate the other.
 *
 * A kind a host has no control for falls back to read-only *in that host*, which is why availability
 * is deliberately not encoded here — see {@link FIELD_KIND_LABEL} for what each one means.
 */
export type FieldKind =
  | 'text'
  | 'multilineText'
  /** An email address or a URL — a text value the host may want to render as a link. */
  | 'link'
  | 'richText'
  | 'number'
  | 'boolean'
  | 'date'
  | 'dateTime'
  | 'dateRange'
  | 'choice'
  | 'reference'
  | 'user'
  | 'workflow'
  | 'rating'
  | 'priority'
  | 'media'
  | 'location'
  /** Derived, computed or otherwise not something a user sets. */
  | 'readOnly'

/** What each kind is for, so a host wiring controls can tell them apart. */
export const FIELD_KIND_LABEL: Record<FieldKind, string> = {
  text: 'Single-line text',
  multilineText: 'Multi-line text',
  link: 'An email address or URL',
  richText: 'Formatted document',
  number: 'Number',
  boolean: 'True/false',
  date: 'Date',
  dateTime: 'Date and time',
  dateRange: 'Date range',
  choice: 'One of a fixed list',
  reference: 'A link to another object',
  user: 'A person',
  workflow: 'A status, moved by a transition',
  rating: 'Stars',
  priority: 'A priority level',
  media: 'An uploaded file',
  location: 'A place',
  readOnly: 'Not set by a user',
}

/**
 * Attribute type code -> the control it wants.
 *
 * Anything absent is {@link readOnly}: a code this version has never heard of is safer treated as
 * "do not offer to write it" than as "probably text".
 */
const KIND_BY_TYPE_CODE: Record<string, FieldKind> = {
  // A TEXT value may contain newlines, so it wants a textarea — which is what the product uses.
  // Treating it as single-line silently prevents entering a value the API accepts.
  TEXT: 'multilineText',
  // Their own kind because a host may well have a link-specific control: the product does, and it
  // gets validation and a mailto/href affordance a plain text box would not.
  EMAIL: 'link',
  URL: 'link',
  IP_ADDRESS: 'text',
  COMPOSITE: 'readOnly', // assembled by the server from other attributes
  RICH_TEXT: 'richText',

  INTEGER: 'number',
  DECIMAL: 'number',
  CALCULATED: 'readOnly', // a formula's result
  RATING: 'rating',

  BOOLEAN: 'boolean',

  DATE: 'date',
  DATETIME: 'dateTime',
  DATE_RANGE: 'dateRange',
  SYSTEM_CREATED: 'readOnly',
  SYSTEM_UPDATED: 'readOnly',

  OPTION: 'choice',
  PRIORITY: 'priority',
  REFERENCE: 'reference',
  USER: 'user',
  SYSTEM_CREATOR: 'readOnly',
  WORKFLOW: 'workflow',

  MEDIA: 'media',
  SYSTEM_IMAGE: 'readOnly', // the object's avatar, set elsewhere
  LOCATION: 'location',

  SEQUENCE: 'readOnly', // allocated by the server
  RANK: 'readOnly', // set by dragging, not by typing
  STREAM: 'readOnly',
  SLA: 'readOnly', // computed from its goals and the object's history
  COMPLETENESS: 'readOnly', // counts the object's other attributes
  DEPRECIATION: 'readOnly', // computed from a schedule
}

/**
 * Anything carrying an attribute type code.
 *
 * Deliberately minimal: the decision depends on nothing else, so both the render model and the
 * product's own native `Attribute` satisfy it structurally — neither side has to convert to ask.
 */
export type HasAttributeTypeCode = { attributeTypeCode: string }

/**
 * The control this attribute wants.
 *
 * A `RICH_TEXT` attribute the product marks read-only still wants a document editor — the kind
 * describes the *value*, and whether this user may write it is a separate question the caller
 * already knows the answer to.
 */
export function fieldKindFor(attribute: HasAttributeTypeCode): FieldKind {
  return KIND_BY_TYPE_CODE[attribute.attributeTypeCode] ?? 'readOnly'
}

/** True when a user could set this attribute at all, whatever controls a given host implements. */
export function isUserSettable(attribute: HasAttributeTypeCode): boolean {
  return fieldKindFor(attribute) !== 'readOnly'
}

// ---------------------------------------------------------------------------
// Value semantics, shared for the same reason the kinds are: they are facts
// about the API's encoding, and every editor was re-deciding them.
// ---------------------------------------------------------------------------

/**
 * What a text-like control's value means as an attribute value.
 *
 * An emptied field is **no value**, not a value that happens to be the empty string — clearing a
 * field and typing `""` are the same intent, and the API has no empty-string value.
 */
export function textFieldValues(next: string | null | undefined): string[] {
  const text = next ?? ''
  return text === '' ? [] : [text]
}

/**
 * What a checkbox means.
 *
 * Unchecking writes `"false"` rather than clearing: a BOOLEAN answered "no" is a different fact from
 * one nobody has answered, and clearing it would lose that distinction. Every editor that got this
 * wrong made "no" indistinguishable from "unanswered".
 */
export function booleanFieldValues(checked: boolean): string[] {
  return [String(checked)]
}

/**
 * What a rating control means. Zero stars is "not rated", so it clears.
 */
export function ratingFieldValues(stars: number): string[] {
  return Number.isFinite(stars) && stars > 0 ? [String(stars)] : []
}

/** What a single-select means — nothing selected clears the attribute. */
export function choiceFieldValues(next: string | null | undefined): string[] {
  return next ? [next] : []
}
