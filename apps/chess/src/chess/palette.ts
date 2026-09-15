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

/**
 * The ground and hairline, per scheme. [saturation, lightness].
 *
 * The foreground is *not* here, and that is the point — see [readable]. These two are safe to pin
 * because a background only has to look right; a foreground has to be legible, and legibility at a
 * fixed lightness is not the same thing at every hue.
 */
const BANDS: Record<ColorScheme, { bg: [number, number]; border: [number, number]; fg: number }> = {
  light: { bg: [72, 91], border: [55, 78], fg: 62 },
  dark: { bg: [38, 20], border: [34, 33], fg: 66 },
}

/**
 * Contrast the foreground must reach against its own ground.
 *
 * WCAG AA for normal text is 4.5:1; this asks for a little more so that rounding, a hue between two
 * of the named ones, and the lighter weights Mantine uses for a card's secondary line all stay
 * inside the margin rather than on it.
 */
const MIN_CONTRAST = 5

/** Relative luminance, per WCAG. */
function luminance(hex: string): number {
  const value = parseInt(hex.slice(1), 16)
  const channel = (raw: number) => {
    const c = raw / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return (
    0.2126 * channel((value >> 16) & 255) +
    0.7152 * channel((value >> 8) & 255) +
    0.0722 * channel(value & 255)
  )
}

export function contrastRatio(a: string, b: string): number {
  const [brighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (brighter + 0.05) / (darker + 0.05)
}

/**
 * A foreground for [background], dark enough (or light enough) to actually be read on it.
 *
 * Pinning the foreground's lightness the way the ground's is pinned looks like the same idea and is
 * not: HSL lightness is not perceived lightness, and green is far brighter than blue at the same
 * number. Measured on the old fixed band, blue read at 6.1:1 and green at **3.7:1** — below the AA
 * floor, on a card whose whole job is to be picked. So the hue and saturation are the design and the
 * lightness is solved: walk away from the ground a percent at a time until the ratio is met, and
 * every hue gets the lightness it needs rather than the one blue happened to need.
 */
function readable(hue: number, scheme: ColorScheme, background: string): string {
  const saturation = BANDS[scheme].fg
  const step = scheme === 'light' ? -1 : 1
  let lightness = scheme === 'light' ? 42 : 68
  let candidate = hslToHex({ h: hue, s: saturation, l: lightness })

  while (lightness > 0 && lightness < 100) {
    if (contrastRatio(candidate, background) >= MIN_CONTRAST) return candidate
    lightness += step
    candidate = hslToHex({ h: hue, s: saturation, l: lightness })
  }
  // Ran out of room: black or white beats any tint that could not get there.
  return scheme === 'light' ? '#000000' : '#ffffff'
}

export function accent(hue: number, scheme: ColorScheme): Accent {
  const band = BANDS[scheme]
  const normalised = ((hue % 360) + 360) % 360
  const at = ([s, l]: [number, number]) => hslToHex({ h: normalised, s, l })
  const background = at(band.bg)
  return { background, border: at(band.border), foreground: readable(normalised, scheme, background) }
}

/** The workspace's hue, or a Starhive blue when its brand colour has none worth keeping. */
export function brandHue(primary: string | undefined): number {
  const hsl = hexToHsl(primary)
  return !hsl || hsl.s < 6 ? 210 : Math.round(hsl.h)
}

/**
 * The two opponent choices.
 *
 * Pinned rather than derived from the workspace brand, which is what they used to be: the second card
 * sat 140° from the first, so a blue workspace got blue and a dull pink and a red one got red and
 * magenta — a pair whose character was an accident of somebody's brand colour. Blue and green are
 * chosen because they are a pair at any moment, they are the two colours a board game is allowed to
 * be cheerful in, and neither carries the "something is wrong" that red and amber do on a screen
 * where they mean exactly that elsewhere.
 *
 * The workspace's colour has not gone anywhere — the board's own squares are still derived from it
 * (`boardTheme.ts`), which is the larger and more visible surface of the two.
 */
export const PERSON_HUE = 210
export const COMPUTER_HUE = 152

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
