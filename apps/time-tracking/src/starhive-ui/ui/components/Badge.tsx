// eslint-disable-next-line no-restricted-imports
import { Badge as MantineBadge, type BadgeProps as MantineBadgeProps } from '@mantine/core'

export type BadgeVariant = 'default' | 'success' | 'warning' | 'critical'

export type BadgeProps = Omit<MantineBadgeProps, 'variant' | 'color'> & {
  variant?: BadgeVariant
}

const COLORS: Record<BadgeVariant, string> = {
  default: 'neutral',
  success: 'positive',
  warning: 'warning',
  critical: 'negative',
}

/** Starhive status badge. */
export function Badge({ variant = 'default', radius = 'sm', ...props }: BadgeProps) {
  return (
    <MantineBadge variant="light" color={COLORS[variant]} radius={radius} tt="none" {...props} />
  )
}
