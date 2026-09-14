/**
 * `@starhive/attributes` — one implementation of "this Starhive attribute, drawn".
 *
 * Pure by design: hand it an attribute and its values, get pixels. No fetching, no react-query, no
 * router, no auth. That is what lets the same code render an attribute in platform-ui and inside a
 * sandboxed app iframe, instead of the product having one renderer and every app writing a worse one.
 *
 * ```tsx
 * import { AttributeValue } from '@starhive/attributes'
 *
 * // In an app, straight off the bridge — the shapes line up, no adapter.
 * <AttributeValue attribute={attribute} object={object} density="table" />
 * ```
 *
 * Anything that genuinely needs a host — a hover preview card, an auth-scoped media URL, a map, the
 * TipTap renderer — is an {@link AttributeSlots} slot with a working fallback, so an app that
 * provides none still gets a correct, well-formatted value.
 */

export { AttributeValue, type AttributeValueProps } from './AttributeValue'

/**
 * The write side. Pure in the same way as the read side: it renders a control and reports a value —
 * it does not fetch, does not save, and is not a form framework.
 */
export { AttributeField, type AttributeFieldProps, isEditable } from './AttributeField'

/**
 * The shared *decision* about which control an attribute wants, and what a control's value means as
 * an attribute value. Consumed by this package's own fields and by platform-ui's inline editors, so
 * the two cannot disagree — see fieldKind.ts.
 */
export {
  booleanFieldValues,
  choiceFieldValues,
  FIELD_KIND_LABEL,
  type FieldKind,
  fieldKindFor,
  type HasAttributeTypeCode,
  isUserSettable,
  ratingFieldValues,
  textFieldValues,
} from './fieldKind'
export type { ChoiceOption, FieldChange, FieldProps } from './fields/types'

/** The field controls the dispatcher draws with, for a caller composing its own form layout. */
export { BooleanField } from './fields/BooleanField'
export { ChoiceField } from './fields/ChoiceField'
export { ChoiceOptionIcon, ChoiceOptionRow } from './fields/ChoiceOptionRow'
export { DateField, dateFieldValue, dateFieldValues } from './fields/DateField'
export { NumberField } from './fields/NumberField'
export { TextField } from './fields/TextField'

export { AttributeSlotsProvider, type AttributeSlots, useAttributeSlots } from './slots'

/**
 * Replace the visual leaves while keeping every rendering decision above them shared. This is how
 * platform-ui consumes the package without giving up its own design system — see registry.tsx.
 */
export {
  type AttributePrimitives,
  AttributePrimitivesProvider,
  type ResolvedPrimitives,
  useAttributePrimitives,
} from './registry'

// The render model. Structurally identical to the bridge's read shapes on purpose — see model.ts.
export type {
  AttributeConfigurationView,
  AttributeValueView,
  AttributeView,
  Density,
  LocationView,
  MediaView,
  NumberFormatterType,
  ObjectView,
  ReferenceView,
  SlaView,
  StateColor,
  StateView,
  UserView,
  WorkflowStateView,
} from './model'
export { optionNameFor, stateFor, valuesOf } from './model'

/**
 * The leaves the dispatcher draws with, exported for an app building something structurally its own —
 * a board with a column per state, a card grid, a legend.
 */
export { Avatar, initialsOf } from './primitives/Avatar'
export { Chip } from './primitives/Chip'
export { EntityIcon, type EntityIconProps, iconDisplayColor } from './primitives/EntityIcon'
export { DateRangeText, type DateRangeTextProps } from './primitives/DateRangeText'
export { DateText, type DateTextProps } from './primitives/DateText'
export { LinkValue, type LinkValueProps } from './primitives/LinkValue'
export { formatCoordinates, LocationValue } from './primitives/LocationValue'
export { MediaValue } from './primitives/MediaValue'
export { NO_VALUE_SIGN, NoValue } from './primitives/NoValue'
export { PriorityValue } from './primitives/PriorityValue'
export { RatingStars } from './primitives/RatingStars'
export { ReferenceChip } from './primitives/ReferenceChip'
export { RestrictedValue } from './primitives/RestrictedValue'
export { SlaValue } from './primitives/SlaValue'
export { DEFAULT_STATE_COLOR, StateBadge } from './primitives/StateBadge'
export { TextValue } from './primitives/TextValue'
export { ValueGroup, type ValueGroupProps } from './primitives/ValueGroup'
export { UserChip } from './primitives/UserChip'

// Formatters, so a caller composing its own layout still matches the product's output exactly.
export {
  formatDate,
  formatDateRange,
  splitDateRange,
  formatDateTime,
  formatFileSize,
  formatNumber,
  formatNumberFor,
} from './format'
export { richTextToPlainText } from './richText'
