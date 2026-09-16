import { Group, Text } from '@mantine/core'
import { displayOf, useObjectQuery } from '@starhive/bridge'
import { Select } from '@starhive/ui'
import { useEffect, useMemo, useState } from 'react'

import type { LoggedAgainst } from './timeEntry'
import { type NominatedType, useNominatedTypes } from './useNominatedTypes'

/** How many objects of a type the picker offers. The most recent ones; search narrows what is here. */
export const CANDIDATE_LIMIT = 200

/**
 * Pick the object to log time on, from any of the nominated types.
 *
 * This is what the id-in-a-text-field bought. With a REFERENCE the app could only ever list its own
 * `Work Item` type — `objects.query` is scoped, and a reference targets one type anyway — so an
 * install pointed at a customer's own type had no picker at all and the app page could only say
 * "log it from the object's own tab". Now every nominated type is readable, and each is listed the
 * same way.
 *
 * The type row is drawn only when there is a choice to make: one nominated type is not a question.
 */
export function WorkItemPicker({
  value,
  onChange,
  disabled,
}: {
  value: LoggedAgainst | null
  onChange: (next: LoggedAgainst | null) => void
  disabled?: boolean
}) {
  const { types, isLoading: typesLoading, unreadable } = useNominatedTypes()
  const [typeId, setTypeId] = useState<string | null>(null)

  // Follow the setting: the first nominated type until somebody picks another, and back to it if the
  // one they picked stops being nominated.
  const selectedType = types.find((type) => type.id === typeId) ?? types[0]
  useEffect(() => {
    if (selectedType && selectedType.id !== typeId) setTypeId(selectedType.id)
  }, [selectedType, typeId])

  if (typesLoading) {
    return (
      <Text size="sm" c="dimmed">
        Loading…
      </Text>
    )
  }

  if (types.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        {unreadable.length > 0
          ? 'The types time is logged on are not ones you can see. Ask an admin.'
          : 'No types are set up for time tracking yet. An admin picks them in the app’s settings.'}
      </Text>
    )
  }

  return (
    <Group gap="sm" grow align="flex-start" wrap="nowrap">
      {types.length > 1 && (
        <Select
          label="Type"
          data={types.map((type) => ({ value: type.id, label: type.name }))}
          value={selectedType.id}
          onChange={(next) => {
            setTypeId(next)
            // The object belonged to the old type; keeping it selected would log against a thing the
            // picker is no longer showing.
            onChange(null)
          }}
          allowDeselect={false}
          disabled={disabled}
          maw={200}
        />
      )}
      <ObjectSelect
        key={selectedType.id}
        type={selectedType}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
    </Group>
  )
}

/**
 * The objects of one type.
 *
 * Its own component so the query belongs to the type being shown: switching type remounts it (via
 * `key`) rather than briefly listing the old type's objects under the new type's name.
 */
function ObjectSelect({
  type,
  value,
  onChange,
  disabled,
}: {
  type: NominatedType
  value: LoggedAgainst | null
  onChange: (next: LoggedAgainst | null) => void
  disabled?: boolean
}) {
  const { data, isLoading, error } = useObjectQuery('order by Created desc', {
    typeId: type.id,
    limit: CANDIDATE_LIMIT,
  })

  const options = useMemo(
    () =>
      (data?.result ?? []).map((object) => ({
        value: object.id,
        label:
          (type.labelAttributeId && displayOf(object, type.labelAttributeId)) ||
          `Untitled (${object.id.slice(0, 8)})`,
      })),
    [data, type.labelAttributeId],
  )

  if (error) {
    return (
      <Text size="sm" c="negative.6">
        Could not list {type.name}: {error.message}
      </Text>
    )
  }

  return (
    <Select
      label={type.name}
      placeholder={isLoading ? 'Loading…' : `Pick a ${type.name.toLowerCase()}`}
      data={options}
      value={value?.id ?? null}
      onChange={(next) => {
        const picked = options.find((option) => option.value === next)
        onChange(picked ? { id: picked.value, label: picked.label, typeId: type.id } : null)
      }}
      searchable
      disabled={disabled || isLoading}
      nothingFoundMessage={
        data && data.total > CANDIDATE_LIMIT
          ? `No match in the ${CANDIDATE_LIMIT} most recent`
          : `No ${type.name.toLowerCase()} yet`
      }
      description={
        data && data.total > CANDIDATE_LIMIT
          ? `The ${CANDIDATE_LIMIT} most recent of ${data.total}. Log from the object’s own Time tab to reach an older one.`
          : undefined
      }
    />
  )
}
