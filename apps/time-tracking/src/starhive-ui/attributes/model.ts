/**
 * The render model: everything `<AttributeValue>` needs to draw an attribute, and nothing else.
 *
 * These types are **structurally identical** to the app-platform bridge's read shapes
 * (`BridgeAttribute`, `BridgeAttributeValue` in `@starhive/bridge/protocol`) — deliberately, not
 * accidentally. That is what lets an app pass what the bridge handed it straight in, with no adapter,
 * while this package keeps zero dependency on the bridge SDK (platform-ui renders attributes without
 * having any use for a postMessage client).
 *
 * `model.compat.test.ts` asserts the assignability in both directions, so the two cannot drift
 * quietly — a comment would not have held.
 *
 * Everything optional here is optional because the *host* may legitimately not know it. A renderer
 * must degrade to `value` rather than blank out.
 */

/** The object a REFERENCE value points at. */
export type ReferenceView = {
  objectId: string
  label: string
  typeId: string
  spaceId?: string
  /** The target's own picture. */
  avatarUrl?: string
  /**
   * The target type's icon, shown when it has no picture of its own.
   *
   * Per value, not per attribute: a reference that includes child types holds objects of several
   * subtypes, each with its own icon.
   */
  iconUrl?: string
  iconColor?: string
}

/** A USER value's identity. A deleted user carries nothing but `isDeleted`. */
export type UserView = {
  id: string
  name?: string
  email?: string
  isDeleted?: boolean
}

/** A WORKFLOW value's state. The colour is schema, not value — see {@link WorkflowStateView}. */
export type StateView = {
  id: string
  name: string
  isEndState: boolean
}

export type MediaView = {
  fileName: string
  contentType: string
  fileSize: number
  thumbnailUrl?: string
  previewUrl?: string
}

export type LocationView = {
  latitude: number
  longitude: number
}

export type SlaView = {
  status: 'RUNNING' | 'PAUSED' | 'STOPPED'
  startDateTime?: string
  dueDateTime?: string
  remainingDuration?: string
  timeTarget?: string
  totalDuration?: string
}

/** One attribute value. Only `value` and `valueId` are guaranteed. */
export type AttributeValueView = {
  value: string
  valueId: string
  /** Host-resolved human text — a reference's label, a user's name, a state's name. */
  display?: string
  ref?: ReferenceView
  user?: UserView
  state?: StateView
  media?: MediaView
  location?: LocationView
  sla?: SlaView
  /** Present but withheld from this viewer. Render the restricted affordance, never a blank. */
  restricted?: true
}

export type StateColor = 'GRAY' | 'RED' | 'GREEN' | 'BLUE' | 'YELLOW' | 'ORANGE' | 'PURPLE'

/** A state of the workflow driving a WORKFLOW attribute, with the workspace's colour for it. */
export type WorkflowStateView = {
  id: string
  name: string
  isEndState: boolean
  color?: StateColor
}

export type NumberFormatterType = 'NONE' | 'CURRENCY' | 'UNIT' | 'PERCENTAGE'

/** The attribute options that affect rendering. A trimmed view, not the product's full config. */
export type AttributeConfigurationView = {
  options?: { id: string; name: string }[]
  priorities?: { id: string; name: string; color: string }[]
  maxRating?: number
  allowHalfValues?: boolean
  numberFormatterType?: NumberFormatterType
  numberFormatterValue?: string
  dateRangeType?: 'DATE' | 'DATE_TIME'
  targetTypeId?: string
  sequencePrefix?: string
  states?: WorkflowStateView[]
}

/**
 * The attribute being drawn.
 *
 * `attributeTypeCode` is a bare `string`, not a union of the 34 known codes: a host newer than this
 * package can send one it has never heard of, and the right answer is the text fallback, not a type
 * error at the boundary or a crash at runtime.
 */
export type AttributeView = {
  id: string
  key?: string
  name: string
  attributeTypeCode: string
  isLabel: boolean
  required?: boolean
  multiValue?: boolean
  workflowId?: string
  configuration?: AttributeConfigurationView
}

/** An object, as far as rendering one of its attributes needs. */
export type ObjectView = {
  id: string
  typeId: string
  spaceId: string
  attributes: { attributeId: string; values: AttributeValueView[] }[]
}

/**
 * How much room the value has.
 *
 * - `default` — an object detail panel: full text, wrapped, hover affordances on.
 * - `table` — a grid cell: single line, truncated.
 * - `compact` — a chip row or card: truncated hard, multi-values collapse to a `+n` count.
 */
export type Density = 'default' | 'table' | 'compact'

/** This attribute's values on the object — empty when it has none. */
export function valuesOf(object: ObjectView, attributeId: string): AttributeValueView[] {
  return object.attributes.find((attribute) => attribute.attributeId === attributeId)?.values ?? []
}

/** The workflow state matching a value, from the attribute's schema. */
export function stateFor(
  attribute: AttributeView,
  value: AttributeValueView,
): WorkflowStateView | undefined {
  return attribute.configuration?.states?.find((state) => state.id === value.value)
}

/**
 * The display name of an OPTION value.
 *
 * The stored value is an option id, so without the attribute's configuration there is nothing to
 * show but a uuid. Older hosts also stored the name directly, hence the second match.
 */
export function optionNameFor(attribute: AttributeView, value: string): string {
  const options = attribute.configuration?.options
  return options?.find((option) => option.id === value || option.name === value)?.name ?? value
}
