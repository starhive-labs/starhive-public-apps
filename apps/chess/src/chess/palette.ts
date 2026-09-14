/**
 * Tinted surfaces, derived rather than picked.
 *
 * Every accent in the app comes from a hue plus the viewer's colour scheme, and the lightness and
 * saturation are pinned per scheme. That is the only way a coloured card works in both: a pale wash
 * that looks cheerful on white is invisible on near-black, and the dark version of the same idea is
 * a deep muted ground with a light foreground — not the same colour dimmed.
 *
 * Same approach as the board's squares (`boardTheme.ts`), for the same reason: hue carries the
 * personality, and the numbers that decide whether text can be read are not left to chance.
 */
import { hexToHsl, hslToHex } from './boardTheme'

export type ColorScheme = 'light' | 'dark'

export type Accent = {
  /** The card's ground. */
  background: string
  /** Its hairline. */
  border: string
  /** Icons and anything that has to be read against [background]. */
  foreground: string
}

const BANDS: Record<ColorScheme, { bg: [number, number]; border: [number, number]; fg: [number, number] }> = {
  // [saturation, lightness]
  light: { bg: [68, 95], border: [52, 84], fg: [58, 36] },
  dark: { bg: [32, 17], border: [28, 30], fg: [60, 72] },
}

export function accent(hue: number, scheme: ColorScheme): Accent {
  const band = BANDS[scheme]
  const at = ([s, l]: [number, number]) => hslToHex({ h: ((hue % 360) + 360) % 360, s, l })
  return { background: at(band.bg), border: at(band.border), foreground: at(band.fg) }
}

/** The workspace's hue, or a Starhive blue when its brand colour has none worth keeping. */
export function brandHue(primary: string | undefined): number {
  const hsl = hexToHsl(primary)
  return !hsl || hsl.s < 6 ? 210 : Math.round(hsl.h)
}

/**
 * The second card's hue.
 *
 * Far enough from the brand to read as a different choice, close enough to look chosen rather than
 * random — the two cards are a pair, not a colour test.
 */
export function partnerHue(primary: string | undefined): number {
  return (brandHue(primary) + 140) % 360
}

/** Fast is hot, slow is cool. */
export const CATEGORY_HUE: Record<string, number> = {
  blitz: 28,
  rapid: 150,
  daily: 265,
}

/** The ladder's ends, for the ramp below. */
const WEAKEST_ELO = 100
const STRONGEST_ELO = 2500

/**
 * Green at the bottom of the ladder, red at the top, through amber in the middle.
 *
 * Interpolated downwards from 145 to 5, so the ramp passes through yellow and orange in the order
 * everybody already reads as "getting harder".
 *
 * Exactly one parameter, deliberately. It began with optional bounds, and `levels.map(levelHue)` —
 * which is how anybody would write it — hands a callback the index and the array as its second and
 * third arguments, so the bounds silently became 0 and an array. One argument cannot be got wrong
 * that way.
 */
export function levelHue(elo: number): number {
  const span = STRONGEST_ELO - WEAKEST_ELO
  const position = Math.max(0, Math.min(1, (elo - WEAKEST_ELO) / span))
  return Math.round(145 - position * 140)
}
