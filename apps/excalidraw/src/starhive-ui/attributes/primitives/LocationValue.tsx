import { Group, Text } from '@mantine/core'

import type { Density, LocationView } from '../model'

/** Six decimal places is roughly 0.1 m — past that the digits are noise. */
const PRECISION = 6

/** `lat, long`, for a title attribute or a caller with no address to show. */
export function formatCoordinates(location: LocationView): string {
  return `${location.latitude.toFixed(PRECISION)}, ${location.longitude.toFixed(PRECISION)}`
}

/**
 * A geographic location.
 *
 * The **value is the address** ("2nd Starhive Road, 12345, Space") and the coordinates ride along in
 * `details` — so the address is what gets shown, with the coordinates in the title where they are
 * available without taking up the cell. Showing the coordinates instead would be technically true
 * and useless to read.
 *
 * A `renderMap` slot replaces this with the real map; that needs an API key and a loader, so it
 * cannot live in a pure renderer.
 */
export function LocationValue({
  value,
  location,
  density = 'default',
}: {
  /** The address as stored. Falls back to the coordinates when the value is empty. */
  value?: string
  location: LocationView
  density?: Density
}) {
  const coordinates = formatCoordinates(location)
  const label = value?.trim() || coordinates

  return (
    <Group
      component="span"
      display="inline-flex"
      gap="xs"
      wrap="nowrap"
      px="xs"
      py={2}
      maw="100%"
      style={(theme) => ({
        borderRadius: theme.radius.sm,
        backgroundColor: 'var(--mantine-color-neutral-2)',
      })}
      title={value?.trim() ? `${value} (${location.latitude}, ${location.longitude})` : coordinates}
    >
      <Text component="span" fz={14} lh={1} aria-hidden>
        📍
      </Text>
      <Text component="span" size="sm" truncate={density === 'default' ? undefined : 'end'}>
        {label}
      </Text>
    </Group>
  )
}
