import { Text } from '@mantine/core'

import type { Density } from '../model'

/**
 * Plain text. Wraps on long words at `default` density and truncates to one line otherwise, because
 * a table cell that grows to fit its content reflows the whole grid.
 */
export function TextValue({ value, density = 'default' }: { value: string; density?: Density }) {
  const truncate = density !== 'default'
  return (
    <Text
      component="span"
      size="sm"
      truncate={truncate ? 'end' : undefined}
      style={truncate ? undefined : { wordBreak: 'break-word' }}
    >
      {value}
    </Text>
  )
}
