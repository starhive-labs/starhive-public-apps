import { Text } from '@mantine/core'
import {
  AttributeValue,
  type Density,
  valuesOf,
  type AttributeView,
  type ObjectView,
} from '@starhive/attributes'
import { attributeBy, useAttribute, useObject, useTypeById } from '@starhive/bridge'
import type { BridgeObject, BridgeType } from '@starhive/bridge'

import { WorkflowControl } from './WorkflowControl'

export type ObjectAttributeProps = {
  /** One of **this app's** objects. The host refuses anything outside its types and space. */
  objectId: string
  /** The attribute's manifest key (preferred) or its display name. */
  attribute: string
  /**
   * The object's type key. Given it, the component skips resolving the type from the object — worth
   * passing in a table, where every row shares one type.
   */
  typeKey?: string
  density?: Density
  /**
   * Set to render a `WORKFLOW` value as a badge rather than a menu of its moves. Everything else is
   * read-only either way — field editing is `<AttributeField>`.
   */
  readOnly?: boolean
  /** Called after a workflow move, with the state the object landed in. */
  onChange?: (stateId: string) => void
}

/**
 * One attribute of one object: read, resolved and drawn.
 *
 * Fetches the object and its schema itself, so a caller supplies two strings instead of wiring
 * `useType` + `useObjectQuery` + an attribute lookup by hand. A `WORKFLOW` attribute additionally
 * becomes a working status control unless `readOnly` — the one write the bridge models first-class.
 *
 * ```tsx
 * <ObjectAttribute objectId={task.id} attribute="status" typeKey="onboardingTask" />
 * ```
 *
 * Prefer passing `typeKey` inside a table: without it every row resolves its own type.
 */
export function ObjectAttribute({
  objectId,
  attribute,
  typeKey,
  density = 'default',
  readOnly = false,
  onChange,
}: ObjectAttributeProps) {
  const object = useObject(objectId)

  // Two ways in: the caller knows the type key, or it is resolved from the object that came back.
  const byKey = useAttribute(typeKey ?? '', attribute)
  const byId = useTypeById(typeKey ? undefined : object.data?.typeId)

  const type: BridgeType | undefined = typeKey ? undefined : byId.data
  const resolved: AttributeView | undefined = typeKey
    ? byKey.data
    : type
      ? attributeBy(type, attribute)
      : undefined

  const isLoading = object.isLoading || (typeKey ? byKey.isLoading : byId.isLoading)
  const error = object.error ?? (typeKey ? byKey.error : byId.error)

  if (isLoading) {
    return (
      <Text component="span" size="sm" c="dimmed">
        …
      </Text>
    )
  }
  if (error || !object.data) {
    return (
      <Text component="span" size="sm" c="dimmed" title={error?.message}>
        —
      </Text>
    )
  }
  if (!resolved) {
    // A missing attribute is a schema mismatch worth naming, not a blank cell: the app asked for
    // something its own type does not have.
    return (
      <Text
        component="span"
        size="sm"
        c="dimmed"
        title={`No attribute "${attribute}" on this type`}
      >
        —
      </Text>
    )
  }

  return (
    <ObjectAttributeValue
      object={object.data}
      attribute={resolved}
      density={density}
      readOnly={readOnly}
      onChange={onChange}
    />
  )
}

/**
 * The drawing half, split out so it can be reused by `<ObjectFields>` and `<ObjectTable>`, which
 * already hold the object and the schema and must not re-fetch them per cell.
 */
export function ObjectAttributeValue({
  object,
  attribute,
  density = 'default',
  readOnly = false,
  onChange,
}: {
  object: BridgeObject | ObjectView
  attribute: AttributeView
  density?: Density
  readOnly?: boolean
  onChange?: (stateId: string) => void
}) {
  const values = valuesOf(object as ObjectView, attribute.id)

  if (attribute.attributeTypeCode === 'WORKFLOW' && !readOnly) {
    return (
      <WorkflowControl
        objectId={object.id}
        attribute={attribute}
        value={values[0]}
        onMoved={onChange}
      />
    )
  }

  return <AttributeValue attribute={attribute} values={values} density={density} />
}
