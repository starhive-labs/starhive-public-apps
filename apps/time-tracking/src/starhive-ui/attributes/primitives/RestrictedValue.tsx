import { Text, Tooltip } from '@mantine/core'

/**
 * A value that exists but is withheld from this viewer.
 *
 * Distinct from {@link NoValue} on purpose: "there is something here you cannot see" and "there is
 * nothing here" are different facts, and collapsing them would quietly mislead.
 */
export function RestrictedValue() {
  return (
    <Tooltip label="You do not have access to this value">
      <Text component="span" size="sm" c="dimmed" fs="italic">
        Restricted
      </Text>
    </Tooltip>
  )
}
