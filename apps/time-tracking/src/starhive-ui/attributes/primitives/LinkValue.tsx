import { Text } from '@mantine/core'

import type { Density } from '../model'

export type LinkValueProps = {
  value: string
  kind: 'EMAIL' | 'URL'
  density?: Density
}

/**
 * An email or a URL as a link.
 *
 * Always `target="_blank"`: an app iframe is sandboxed and cross-origin to the host, so a same-tab
 * navigation either does nothing or replaces the app. `noreferrer` keeps the app's origin out of the
 * target's logs.
 */
export function LinkValue({ value, kind, density = 'default' }: LinkValueProps) {
  return (
    <Text
      component="a"
      href={kind === 'EMAIL' ? `mailto:${value}` : value}
      size="sm"
      c="primary"
      truncate={density === 'default' ? undefined : 'end'}
      target="_blank"
      rel="noopener noreferrer"
      title={value}
      onClick={(event) => event.stopPropagation()}
    >
      {value}
    </Text>
  )
}
