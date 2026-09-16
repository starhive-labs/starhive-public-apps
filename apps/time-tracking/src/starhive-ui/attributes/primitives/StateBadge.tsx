import { Box, Group, Text } from '@mantine/core'

import type { StateColor } from '../model'

/** The product's palette keys mapped onto Mantine's. `PURPLE` is Mantine's `grape`. */
const MANTINE_COLOR: Record<StateColor, string> = {
  GRAY: 'gray',
  RED: 'red',
  GREEN: 'green',
  BLUE: 'blue',
  YELLOW: 'yellow',
  ORANGE: 'orange',
  PURPLE: 'grape',
}

/**
 * The default when a workspace never gave the state a colour, matching the product's
 * `DEFAULT_WORKFLOW_STATES_COLOR`. The default lives here rather than on the wire so a host that
 * could not reach the colour service still produces the same badge.
 */
export const DEFAULT_STATE_COLOR: StateColor = 'BLUE'

/**
 * A workflow state: a coloured pill, with a checkmark instead of the dot on a terminal state.
 *
 * Takes the colour as a prop — no fetching. That single change is what makes the badge shareable:
 * the product's own `StateBadgeWithFetch` runs a suspense query mid-render, so it could never have
 * been drawn inside an app iframe.
 */
export function StateBadge({
  name,
  color = DEFAULT_STATE_COLOR,
  isEndState = false,
  emphasized = false,
}: {
  name: string
  color?: StateColor
  isEndState?: boolean
  /** Object-details-header treatment: larger text and an outline. */
  emphasized?: boolean
}) {
  const mantineColor = MANTINE_COLOR[color] ?? MANTINE_COLOR[DEFAULT_STATE_COLOR]

  return (
    <Group
      component="span"
      display="inline-flex"
      gap="xs"
      wrap="nowrap"
      maw="fit-content"
      px="sm"
      py={2}
      bg={`${mantineColor}.0`}
      style={(theme) => ({
        borderRadius: theme.radius.lg,
        border: emphasized ? `1px solid var(--mantine-color-${mantineColor}-6)` : undefined,
      })}
    >
      {isEndState ? (
        <Text component="span" c={mantineColor} fz={10} lh={1} aria-hidden>
          ✓
        </Text>
      ) : (
        <Box
          component="span"
          w={8}
          h={8}
          bg={mantineColor}
          style={{ borderRadius: '50%', flexShrink: 0 }}
          aria-hidden
        />
      )}
      <Text
        component="span"
        size={emphasized ? 'md' : 'sm'}
        fw={600}
        c={mantineColor}
        truncate="end"
      >
        {name}
      </Text>
    </Group>
  )
}
