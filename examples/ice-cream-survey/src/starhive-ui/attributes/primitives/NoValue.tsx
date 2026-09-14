import { Text } from '@mantine/core'

/** What the product shows where a value would be. An em dash, not an empty cell. */
export const NO_VALUE_SIGN = '—'

export function NoValue() {
  return (
    <Text component="span" size="sm" c="dimmed" aria-label="No value">
      {NO_VALUE_SIGN}
    </Text>
  )
}
