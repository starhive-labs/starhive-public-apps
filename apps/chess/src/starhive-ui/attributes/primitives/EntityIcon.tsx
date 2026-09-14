import { Avatar as MantineAvatar, Box, Text } from '@mantine/core'

import type { Density } from '../model'
import { initialsOf } from './Avatar'

const SIZE: Record<Density, number> = { default: 24, table: 20, compact: 16 }

export type EntityIconProps = {
  /** Used for the initials fallback, and as the image's accessible context. */
  label: string
  /** The thing's own picture — an object's `SYSTEM_IMAGE`, a user's avatar. */
  avatarUrl?: string
  /** Its type's icon, for when it has no picture of its own. */
  iconUrl?: string
  /** The icon's configured tint. */
  iconColor?: string
  density?: Density
}

/**
 * The two grey icon tints, remapped to scheme-aware tokens.
 *
 * A stored icon colour is a fixed hex, so using it verbatim gives a light-mode colour in dark mode.
 * The greys are the ones that matter: they are illegible on a dark ground, and `#4E5473` is what
 * *every* icon with no explicit colour carries — `getStarhiveProvidedIcon` defaults to it, so the
 * default Starhive mark on every app-provisioned type came out dark-on-dark.
 *
 * `text-4` is a virtual colour: `#4E5473` in light, `#A9AEC6` in dark. The colourful tints are
 * legible on both schemes and pass through untouched.
 *
 * Mirrors platform-ui's `lookupIconDisplayColor`, with one deviation: the product sends `#868E96` to
 * `gray-6`, but Mantine's built-in `gray` is not scheme-remapped in the app theme (that is part of
 * the `packages/theme` divergence), so both greys land on `text-4` here.
 */
const ICON_DISPLAY_COLOR: Record<string, string> = {
  '#4E5473': 'var(--mantine-color-text-4)',
  '#868E96': 'var(--mantine-color-text-4)',
}

/** The colour to actually paint a type icon in, for the active scheme. */
export function iconDisplayColor(color: string | undefined): string {
  if (!color) return 'var(--mantine-color-text-4)'
  return ICON_DISPLAY_COLOR[color.toUpperCase()] ?? color
}

/**
 * A type icon, drawn the way the product draws it: as a **CSS mask** tinted with the icon's colour,
 * not as an `<img>`.
 *
 * The hosted SVGs are monochrome silhouettes, so rendering one directly would show its own fill and
 * ignore the workspace's chosen colour — including in dark mode. Masking is what makes the tint mean
 * anything.
 *
 * The `?v=2` is the product's own workaround for a CORS error when moving from
 * `WebkitMaskBoxImage` to `WebkitMaskImage`; kept identical so both load the same cached asset.
 */
function TypeIconMask({ url, color, size }: { url: string; color?: string; size: number }) {
  const masked = `url(${url}?v=2)`
  return (
    <Box
      component="span"
      aria-hidden
      w={size}
      h={size}
      style={{
        display: 'inline-block',
        flexShrink: 0,
        maskImage: masked,
        WebkitMaskImage: masked,
        maskSize: '100%',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        backgroundColor: iconDisplayColor(color),
      }}
    />
  )
}

/**
 * The picture beside a named thing: **its own avatar, else its type's icon, else its initials.**
 *
 * That precedence is the product's, and the type-icon step is the one that matters — it is what makes
 * a reference read as a *Work Item* rather than as a string. One implementation, shared by the
 * reference chip and the reference picker, because two copies of it disagreed once already.
 */
export function EntityIcon({
  label,
  avatarUrl,
  iconUrl,
  iconColor,
  density = 'default',
}: EntityIconProps) {
  const size = SIZE[density]

  if (avatarUrl) {
    return <MantineAvatar src={avatarUrl} size={size} radius="sm" alt="" />
  }
  if (iconUrl) {
    return <TypeIconMask url={iconUrl} color={iconColor} size={size} />
  }
  return (
    <MantineAvatar size={size} radius="sm" alt="">
      <Text component="span" fz={Math.round(size * 0.45)}>
        {initialsOf(label)}
      </Text>
    </MantineAvatar>
  )
}
