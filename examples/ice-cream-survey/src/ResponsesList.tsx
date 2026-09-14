import { Group, Stack, Table, Text } from '@mantine/core'
import { rawValueOf, useAttributes, useConfig, useObjectQuery } from '@starhive/bridge'
import { ObjectAttributeValue, Rating } from '@starhive/ui'

import { ATTR, ATTR_NAME, averageRating, readConfig, RESPONSE_KEY } from './survey'

/**
 * Lists survey responses. When a `flavorId` is given (objectPanel slot) it filters on the flavor
 * reference server-side and drops the Flavor column, since it is fixed.
 *
 * Every cell but one is drawn by `<ObjectAttributeValue>`, the same renderer Starhive uses — so the
 * date reads the way Starhive formats dates and the flavor shows its label and icon. That last part
 * used to cost a second query for 500 flavors to build an id→label map by hand; at protocol v2 the
 * reference arrives already resolved, so the map is gone.
 *
 * The rating column stays ours: `rating` is a `DECIMAL`, which the shared renderer draws as a number.
 * Read-only stars are what a survey wants, and one custom column is exactly what composing
 * `ObjectAttributeValue` is for rather than reaching for `<ObjectTable>`.
 *
 * Remount with a `key` to refetch after rating.
 */
export function ResponsesList({ flavorId }: { flavorId?: string }) {
  const { config } = useConfig()
  const { maxRating } = readConfig(config)

  const showFlavor = !flavorId
  const columns = useAttributes(RESPONSE_KEY, [
    ATTR.date,
    ...(showFlavor ? [ATTR.flavor] : []),
    ATTR.rating,
    ATTR.respondent,
    ATTR.comment,
  ])

  // StarQL matches on display names (it queries the search index), while the columns above are named
  // by manifest key — see ATTR / ATTR_NAME.
  const where = flavorId ? `"${ATTR_NAME.flavor}" = objectId("${flavorId}") ` : ''
  const { data, isLoading, error } = useObjectQuery(`${where}order by Created desc`, {
    typeKey: RESPONSE_KEY,
    limit: 100,
  })

  if (isLoading || columns.isLoading) {
    return (
      <Text size="sm" c="dimmed">
        Loading responses…
      </Text>
    )
  }
  if (error || columns.error) {
    return (
      <Text size="sm" c="negative.6">
        {(error ?? columns.error)?.message ?? 'Could not load responses.'}
      </Text>
    )
  }

  const responses = data?.result ?? []
  if (responses.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No ratings yet.
      </Text>
    )
  }

  const ratingColumn = columns.data.find((column) => column.key === ATTR.rating)
  const average = ratingColumn ? averageRating(responses, ratingColumn.id) : 0

  return (
    <Stack gap="sm">
      {columns.missing.length > 0 && (
        <Text size="xs" c="warning.6">
          No such attribute: {columns.missing.join(', ')}
        </Text>
      )}
      <Table striped highlightOnHover verticalSpacing="xs" fz="sm">
        <Table.Thead>
          <Table.Tr>
            {columns.data.map((column) => (
              <Table.Th key={column.id}>{column.name}</Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {responses.map((response) => (
            <Table.Tr key={response.id}>
              {columns.data.map((column) => (
                <Table.Td key={column.id}>
                  {column.key === ATTR.rating ? (
                    <Rating
                      value={Number(rawValueOf(response, column.id) ?? '0')}
                      count={maxRating}
                      readOnly
                      size="xs"
                    />
                  ) : (
                    <ObjectAttributeValue object={response} attribute={column} density="compact" />
                  )}
                </Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      <Group gap="sm">
        <Rating value={average} fractions={2} count={maxRating} readOnly size="sm" />
        <Text size="sm" c="dimmed">
          {average.toFixed(1)} average · {responses.length}{' '}
          {responses.length === 1 ? 'rating' : 'ratings'}
        </Text>
      </Group>
    </Stack>
  )
}
