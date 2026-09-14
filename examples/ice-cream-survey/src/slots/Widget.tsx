import { Group, Stack, Text } from '@mantine/core'
import { useAttributes, useConfig, useObjectQuery } from '@starhive/bridge'
import { Rating } from '@starhive/ui'

import { RateForm } from '../RateForm'
import { ATTR, averageRating, readConfig, RESPONSE_KEY } from '../survey'
import { useReloadAfterIndex } from '../useReloadAfterIndex'

/** Live average across all ratings — remounted (via `key`) after a submission to refresh. */
function Summary() {
  // Only the rating attribute is needed, not the whole type schema.
  const rating = useAttributes(RESPONSE_KEY, [ATTR.rating])
  const { config } = useConfig()
  const { maxRating } = readConfig(config)
  const { data, isLoading } = useObjectQuery('order by Created desc', {
    typeKey: RESPONSE_KEY,
    limit: 200,
  })

  const ratingAttribute = rating.data[0]
  if (isLoading || rating.isLoading || !ratingAttribute || !data) return null
  const count = data.result.length
  if (count === 0) {
    return (
      <Text size="sm" c="dimmed">
        Be the first to rate!
      </Text>
    )
  }
  const average = averageRating(data.result, ratingAttribute.id)
  return (
    <Group gap="xs">
      <Rating value={average} fractions={2} count={maxRating} readOnly size="sm" />
      <Text size="sm" c="dimmed">
        {average.toFixed(1)} · {count} {count === 1 ? 'rating' : 'ratings'}
      </Text>
    </Group>
  )
}

/**
 * The centerpiece: a compact "Rate our ice cream" card for any dashboard. People pick a flavor,
 * tap a star rating and submit without leaving the page; the header shows the running average.
 *
 * Deliberately not wrapped in a `Card`. The dashboard cell around this iframe already paints the
 * background, border and radius the person configured under the widget's appearance, and hands us a
 * transparent ground so it shows through (see `useApplyHostTheme`). A `Card` here would draw a second
 * frame — its own border and shadow — inside the one they chose, which reads as the appearance being
 * ignored. Padding is all the widget adds; the frame is the host's.
 */
export function Widget() {
  const { key, reload } = useReloadAfterIndex()
  return (
    <Stack gap="sm" p="sm">
      <Group justify="space-between" align="center">
        <Text fw={600}>Rate our ice cream</Text>
        <Summary key={key} />
      </Group>
      <RateForm compact onSubmitted={reload} />
    </Stack>
  )
}
