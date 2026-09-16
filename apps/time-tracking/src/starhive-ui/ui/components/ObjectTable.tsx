import { Stack, Table, Text } from '@mantine/core'
import type { AttributeView } from '@starhive/attributes'
import { useAttributes, useObjectQuery } from '@starhive/bridge'
import type { BridgeObject } from '@starhive/bridge'
import { type ReactNode, useMemo } from 'react'

import { ObjectAttributeValue } from './ObjectAttribute'

export type ObjectTableProps = {
  /** The manifest type key whose objects to list. */
  typeKey: string
  /** Columns, by manifest attribute key (preferred) or display name, in the order given. */
  attributes: string[]
  /**
   * A StarQL predicate, without `order by` — e.g. `'"New hire" = objectId("abc")'`.
   *
   * Filtering belongs here rather than in the caller's own `.filter()`: the host runs it against the
   * search index, so 10 rows come back instead of 500.
   */
  where?: string
  /** StarQL ordering. Defaults to newest first. */
  orderBy?: string
  limit?: number
  /**
   * A predicate StarQL cannot express — e.g. "in a state whose *manifest key* is `done`", where the
   * app knows keys and StarQL matches display names.
   *
   * Applied to the rows the query already returned, so it **narrows a page rather than searching the
   * type**: with `limit` 100 and 500 matching objects, this filters the first 100. `where` is what
   * searches. Reach for this only when `where` genuinely cannot say it.
   */
  filter?: (object: BridgeObject, columns: AttributeView[]) => boolean
  /** Attribute keys that render as controls rather than values. Only `WORKFLOW` is writable today. */
  editable?: string[]
  /** Shown when the query returns nothing. */
  empty?: ReactNode
  /**
   * Rendered under the table — a total, a count, whatever the app wants to say about the rows.
   * Gets the resolved columns too, since a footer summarising one needs its attribute id.
   */
  footer?: (objects: BridgeObject[], columns: AttributeView[]) => ReactNode
  /** Column header text. Defaults to the attribute's display name. */
  header?: (attribute: AttributeView) => ReactNode
}

/**
 * A table of an app's objects, with one column per attribute.
 *
 * Does the whole read: query, schema, column resolution and per-cell rendering. Every cell is drawn
 * by the same `@starhive/attributes` renderer the product uses, so a date reads the way Starhive
 * formats dates and a reference shows its target's label rather than a uuid — without the app
 * fetching the targets to build an id→label map of its own.
 *
 * ```tsx
 * <ObjectTable
 *   typeKey="onboardingTask"
 *   attributes={['title', 'status', 'dueDate']}
 *   editable={['status']}
 * />
 * ```
 */
export function ObjectTable({
  typeKey,
  attributes,
  where,
  orderBy = 'Created desc',
  limit = 100,
  filter,
  editable,
  empty = 'Nothing to show.',
  footer,
  header,
}: ObjectTableProps) {
  const columns = useAttributes(typeKey, attributes)
  const starql = where ? `${where} order by ${orderBy}` : `order by ${orderBy}`
  const { data, isLoading, error } = useObjectQuery(starql, { typeKey, limit })

  const editableKeys = useMemo(() => new Set(editable ?? []), [editable])

  if (isLoading || columns.isLoading) {
    return (
      <Text size="sm" c="dimmed">
        Loading…
      </Text>
    )
  }
  if (error || columns.error) {
    return (
      <Text size="sm" c="negative.6">
        {(error ?? columns.error)?.message ?? 'Could not load.'}
      </Text>
    )
  }

  const returned = data?.result ?? []
  const objects = filter ? returned.filter((object) => filter(object, columns.data)) : returned
  if (objects.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        {empty}
      </Text>
    )
  }

  return (
    <Stack gap="sm">
      {/* A schema mismatch is surfaced rather than silently dropping a column the app asked for. */}
      {columns.missing.length > 0 && (
        <Text size="xs" c="warning.6">
          No such attribute: {columns.missing.join(', ')}
        </Text>
      )}
      <Table striped highlightOnHover verticalSpacing="xs" fz="sm">
        <Table.Thead>
          <Table.Tr>
            {columns.data.map((column) => (
              <Table.Th key={column.id}>{header?.(column) ?? column.name}</Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {objects.map((object) => (
            <Table.Tr key={object.id}>
              {columns.data.map((column) => (
                <Table.Td key={column.id}>
                  <ObjectAttributeValue
                    object={object}
                    attribute={column}
                    density="table"
                    readOnly={!isEditable(column, editableKeys)}
                  />
                </Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {footer ? <div>{footer(objects, columns.data)}</div> : null}
    </Stack>
  )
}

/** Matched on the manifest key or the display name, the same two handles the columns take. */
function isEditable(attribute: AttributeView, editable: Set<string>): boolean {
  return (
    (attribute.key !== undefined && editable.has(attribute.key)) || editable.has(attribute.name)
  )
}
