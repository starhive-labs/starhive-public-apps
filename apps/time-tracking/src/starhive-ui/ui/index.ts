export { StarhiveAppProvider } from './StarhiveAppProvider'
export { Badge, type BadgeProps, type BadgeVariant } from './components/Badge'
export { Button, type ButtonProps, type ButtonVariant } from './components/Button'
export { Card, type CardProps } from './components/Card'
export { Rating, type RatingProps } from './components/Rating'
export { Select, type SelectProps } from './components/Select'
export { TextInput, type TextInputProps } from './components/TextInput'

/**
 * Bridge-aware components: they read, resolve and draw on their own, so an app supplies a couple of
 * strings instead of wiring `useType` + `useObjectQuery` + an attribute lookup by hand.
 *
 * They work on the app's **own** objects — the bridge refuses anything outside its provisioned types
 * and space, so the object an `objectPanel` is mounted beside is a filter value, not something to
 * read.
 */
export {
  ObjectAttribute,
  type ObjectAttributeProps,
  ObjectAttributeValue,
} from './components/ObjectAttribute'
export { ObjectField, type ObjectFieldProps } from './components/ObjectField'
export { ObjectFields, type ObjectFieldsProps } from './components/ObjectFields'
export { type FormDraft, ObjectForm, type ObjectFormProps } from './components/ObjectForm'
export { ObjectTable, type ObjectTableProps } from './components/ObjectTable'
export { WorkflowControl, type WorkflowControlProps } from './components/WorkflowControl'

/**
 * The shared attribute renderers, re-exported so an app has one import for the whole component SDK.
 * These are the same components platform-ui draws attributes with — see `@starhive/attributes`.
 */
export {
  AttributePrimitivesProvider,
  type AttributePrimitives,
  AttributeSlotsProvider,
  type AttributeSlots,
  AttributeField,
  type AttributeFieldProps,
  AttributeValue,
  type AttributeValueProps,
  type AttributeValueView,
  type AttributeView,
  Chip,
  type ChoiceOption,
  type Density,
  FIELD_KIND_LABEL,
  type FieldChange,
  type FieldKind,
  fieldKindFor,
  isEditable,
  isUserSettable,
  formatDate,
  formatDateRange,
  formatDateTime,
  formatFileSize,
  formatNumber,
  LocationValue,
  MediaValue,
  NO_VALUE_SIGN,
  NoValue,
  type ObjectView,
  PriorityValue,
  RatingStars,
  ReferenceChip,
  RestrictedValue,
  richTextToPlainText,
  SlaValue,
  StateBadge,
  type StateColor,
  TextValue,
  UserChip,
  valuesOf,
  type WorkflowStateView,
} from '@starhive/attributes'

// Re-export the tokens/theme so apps can read raw values or extend the theme if needed.
export { FONT_FAMILY, FONT_WEIGHTS, starhiveTheme, themeResolver } from '@starhive/theme'
