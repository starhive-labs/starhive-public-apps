import { Avatar as MantineAvatar } from '@mantine/core'

import type { Density } from '../model'

const SIZE: Record<Density, number> = { default: 24, table: 20, compact: 16 }

/** Initials of a name or email, the way the product derives them. */
export function initialsOf(label: string): string {
  const trimmed = label.trim()
  if (!trimmed) return '?'
  const words = trimmed.split(/\s+/).filter(Boolean)
  if (words.length >= 2) {
    return `${words[0]?.[0] ?? ''}${words[1]?.[0] ?? ''}`.toUpperCase()
  }
  return trimmed.slice(0, 2).toUpperCase()
}

export function Avatar({
  label,
  src,
  density = 'default',
}: {
  label: string
  src?: string
  density?: Density
}) {
  return (
    <MantineAvatar src={src} size={SIZE[density]} radius="xl" alt="">
      {initialsOf(label)}
    </MantineAvatar>
  )
}
