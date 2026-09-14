import { Group, Stack, Text } from '@mantine/core'
import type { AttributeView } from '@starhive/attributes'
import { useObject, useTypeById } from '@starhive/bridge'

import { ObjectAttributeValue } from './ObjectAttribute'

export type ObjectFieldsProps = {
  /**
   * One of **this app's** objects.
   *
   * Not the object an `objectPanel` is mounted beside: that one belongs to the host, and the bridge
   * refuses any object outside the app's own provisioned types and space. Its id is useful as a
   * filter value in a query, not as something to read.
   */
  objectId: string
  /** Attribute keys or names to show, in order. Defaults to every attribute on the type. */
  include?: string[]
  /** Attribute keys or names to leave out. Ignored when `include` is given. */
  exclude?: string[]
  /** Show the label attribute as a field too. Off by default — it is usually the panel's heading. */
  withLabel?: boolean
  /** Attribute keys that render as controls. Only `WORKFLOW` is writable today. */
  editable?: string[]
}

/**
 * Every attribute of one of the app's objects, as a name/value list.
 *
 * The read-only counterpart of an object detail panel: hand it an id and it draws the whole object
 * the way Starhive would, without the app naming a single attribute.
 *
 * ```tsx
 * <ObjectFields objectId={task.id} exclude={['notes']} editable={['status']} />
 * ```
 */
export function ObjectFields({
  objectId,
  include,
  exclude,
  withLabel = false,
  editable,
}: ObjectFieldsProps) {
  const object = useObject(objectId)
  const type = useTypeById(object.data?.typeId)

  if (object.isLoading || type.isLoading) {
    return (
      <Text size="sm" c="dimmed">
        Loading…
      </Text>
    )
  }
  if (object.error || type.error || !object.data || !type.data) {
    return (
      <Text size="sm" c="negative.6">
        {(object.error ?? type.error)?.message ?? 'Could not load this object.'}
      </Text>
    )
  }

  const shown = selectAttributes(type.data.attributes, { include, exclude, withLabel })
  const editableKeys = new Set(editable ?? [])

  return (
    <Stack gap="xs">
      {shown.map((attribute) => (
        <Group key={attribute.id} gap="sm" wrap="nowrap" align="flex-start">
          <Text size="sm" c="dimmed" w={140} style={{ flexShrink: 0 }}>
            {attribute.name}
          </Text>
          <ObjectAttributeValue
            object={object.data!}
            attribute={attribute}
            readOnly={!matches(attribute, editableKeys)}
          />
        </Group>
      ))}
    </Stack>
  )
}

/**
 * Which attributes to draw, honouring the caller's order when `include` is given.
 *
 * `include` wins over `exclude` rather than combining: a caller that has listed exactly what it
 * wants has already said everything, and applying both would make the order ambiguous.
 */
function selectAttributes(
  attributes: AttributeView[],
  { include, exclude, withLabel }: Pick<ObjectFieldsProps, 'include' | 'exclude' | 'withLabel'>,
): AttributeView[] {
  if (include?.length) {
    const wanted = new Set(include)
    // The caller's order, not the schema's.
    return include
      .map((key) => attributes.find((attribute) => matches(attribute, wanted, key)))
      .filter((attribute): attribute is AttributeView => Boolean(attribute))
  }

  const unwanted = new Set(exclude ?? [])
  return attributes.filter(
    (attribute) => (withLabel || !attribute.isLabel) && !matches(attribute, unwanted),
  )
}

/** Matched on the manifest key or the display name — the two handles a caller has. */
function matches(attribute: AttributeView, keys: Set<string>, only?: string): boolean {
  if (only) return attribute.key === only || attribute.name === only
  return (attribute.key !== undefined && keys.has(attribute.key)) || keys.has(attribute.name)
}
