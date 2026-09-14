import { Text } from '@mantine/core'

import type { Density } from '../model'

export type DateRangeTextProps = {
  /** The raw ends, for `<time dateTime>`. */
  from: string
  to: string
  formattedFrom: string
  formattedTo: string
  density?: Density
}

/**
 * A date range as two `<time>` elements around a dash, so each end stays machine-readable.
 *
 * The formatting is the dispatcher's; this only lays it out.
 */
export function DateRangeText({
  from,
  to,
  formattedFrom,
  formattedTo,
  density = 'default',
}: DateRangeTextProps) {
  return (
    <Text component="span" size="sm" truncate={density === 'default' ? undefined : 'end'}>
      <time dateTime={from}>{formattedFrom}</time>
      {formattedFrom && formattedTo ? ' - ' : ''}
      <time dateTime={to}>{formattedTo}</time>
    </Text>
  )
}
