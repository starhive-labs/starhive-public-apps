import { Box } from '@mantine/core'

import type { AttributeConfigurationView, Density } from '../model'
import { Chip } from './Chip'

/**
 * A priority level, coloured as the workspace configured it.
 *
 * The colour comes off the attribute's own configuration, which is why it is a plain prop here — no
 * lookup table of level names, so a workspace that renamed or reordered its priorities still draws
 * correctly.
 */
export function PriorityValue({
  value,
  configuration,
  density = 'default',
}: {
  value: string
  configuration?: AttributeConfigurationView
  density?: Density
}) {
  const priority = configuration?.priorities?.find((p) => p.id === value || p.name === value)
  if (!priority) return <Chip label={value} density={density} />

  return (
    <Chip
      label={priority.name}
      density={density}
      leading={
        <Box
          component="span"
          w={8}
          h={8}
          style={{ borderRadius: '50%', backgroundColor: priority.color, flexShrink: 0 }}
          aria-hidden
        />
      }
    />
  )
}
