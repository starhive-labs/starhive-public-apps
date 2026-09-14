import { Group, Stack, Text } from '@mantine/core'
import { useAttributes, useConfig, useStarhiveContext } from '@starhive/bridge'
import { ObjectForm, Rating } from '@starhive/ui'
import { useState } from 'react'

import {
  ATTR,
  clampRating,
  defaultResponseLabel,
  FLAVOR_KEY,
  readConfig,
  RESPONSE_KEY,
  todayIso,
} from './survey'

/**
 * Reusable "rate an ice cream" form. When `flavorId` is provided (objectPanel slot) the Flavor
 * reference is fixed; otherwise it is picked from the flavor type.
 *
 * `<ObjectForm>` draws a field per attribute and calls `objects.create`, so the flavor reference gets
 * the same picker Starhive uses — target labels and avatars rather than object ids. What stays here is
 * the part that is actually about a survey: the star control, the fallback label, and the date stamp.
 *
 * The stars are deliberately the app's own. `rating` is a `DECIMAL` attribute, which the shared
 * renderer draws as a number — correctly, since that is what it is. A survey wants a star to tap, so
 * the control lives here and is merged into the payload in `beforeSubmit`. (Starhive has a native
 * `RATING` type that would draw stars for free, but its star count is fixed at provision time, and
 * this app lets an admin set `maxRating`.)
 *
 * `compact` (the widget) drops the respondent and comment fields so the card stays small — just pick
 * a flavor and tap a star.
 */
export function RateForm({
  flavorId,
  compact = false,
  onSubmitted,
}: {
  flavorId?: string
  compact?: boolean
  onSubmitted?: () => void
}) {
  const { typeKeyToId } = useStarhiveContext()
  const { config } = useConfig()
  const { maxRating, flavorType } = readConfig(config)

  // Resolved here as well as inside the form, because `rating` and `date` are written without being
  // drawn — the stars are our own control, and the date is a stamp rather than something to ask for.
  const schema = useAttributes(RESPONSE_KEY, [
    ATTR.flavor,
    ATTR.rating,
    ATTR.comment,
    ATTR.respondent,
    ATTR.date,
  ])
  const idOf = (key: string) => schema.data.find((attribute) => attribute.key === key)?.id

  const [rating, setRating] = useState(0)

  // Object queries are scoped to the app's own types, so candidates can only be listed while the
  // reference still points at the type this app provisioned. An admin who re-pointed it in settings
  // gets a field with no candidate list rather than a wrong one.
  const usesOwnFlavorType = !flavorType || flavorType === typeKeyToId[FLAVOR_KEY]

  return (
    <ObjectForm
      typeKey={RESPONSE_KEY}
      attributes={compact ? [ATTR.flavor] : [ATTR.flavor, ATTR.respondent, ATTR.comment]}
      referenceTypes={usesOwnFlavorType ? { [ATTR.flavor]: FLAVOR_KEY } : undefined}
      initial={flavorId ? { [ATTR.flavor]: [flavorId] } : undefined}
      readOnly={flavorId ? [ATTR.flavor] : undefined}
      submitLabel="Submit rating"
      onCreated={() => {
        setRating(0)
        onSubmitted?.()
      }}
      beforeSubmit={(draft) => {
        const stars = clampRating(rating, maxRating)
        if (stars < 1) return 'Tap a star to rate'

        const ids = {
          flavor: idOf(ATTR.flavor),
          rating: idOf(ATTR.rating),
          comment: idOf(ATTR.comment),
          respondent: idOf(ATTR.respondent),
          date: idOf(ATTR.date),
        }
        if (!ids.flavor || !ids.rating || !ids.comment || !ids.date) {
          return 'The Survey Response type is missing an attribute'
        }

        const comment = draft[ids.comment]?.[0]?.trim()
        const respondent = ids.respondent ? draft[ids.respondent]?.[0]?.trim() : undefined

        return [
          { attributeId: ids.flavor, values: draft[ids.flavor] ?? [] },
          { attributeId: ids.rating, values: [String(stars)] },
          // `comment` is the type's label attribute, so it must always have a value.
          { attributeId: ids.comment, values: [comment || defaultResponseLabel()] },
          { attributeId: ids.date, values: [todayIso()] },
          ...(respondent ? [{ attributeId: ids.respondent as string, values: [respondent] }] : []),
        ].filter((attribute) => attribute.values.length > 0)
      }}
    >
      <Stack gap={4}>
        <Text size="sm" fw={500}>
          Rating
        </Text>
        <Group gap="sm">
          <Rating value={rating} onChange={setRating} count={maxRating} size="lg" />
          {rating > 0 && (
            <Text size="sm" c="dimmed">
              {rating}/{maxRating}
            </Text>
          )}
        </Group>
      </Stack>
    </ObjectForm>
  )
}
