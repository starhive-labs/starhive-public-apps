import { Group } from '@mantine/core'
import type { ReactNode } from 'react'

import type { Density } from '../model'
import { Chip } from './Chip'

/** How many chips a `compact` row shows before collapsing the rest into a `+n`. */
const COMPACT_CHIP_LIMIT = 2

export type ValueGroupProps = {
  children: ReactNode[]
  density: Density
  /** Total number of values, which is `children.length` — passed so an override need not count. */
  count: number
}

/**
 * Several values side by side.
 *
 * At `compact` density the row is capped and the tail becomes a count, because a cell that grows to
 * fit its content pushes every other column off the screen. platform-ui overrides this with its
 * IntersectionObserver version, which measures the real available width instead of guessing at two.
 */
export function ValueGroup({ children, density, count }: ValueGroupProps) {
  if (density === 'compact' && count > COMPACT_CHIP_LIMIT) {
    return (
      <Group component="span" display="inline-flex" gap="xs" wrap="nowrap">
        {children.slice(0, COMPACT_CHIP_LIMIT)}
        <Chip label={`+${count - COMPACT_CHIP_LIMIT}`} density={density} />
      </Group>
    )
  }
  return (
    <Group
      component="span"
      display="inline-flex"
      gap="xs"
      wrap={density === 'table' ? 'nowrap' : 'wrap'}
    >
      {children}
    </Group>
  )
}
