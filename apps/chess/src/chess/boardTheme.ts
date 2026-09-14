/**
 * The board's two square colours, taken from the workspace's own brand colour.
 *
 * Derived rather than copied. A board painted with the raw `primary` would be unreadable the moment
 * a workspace picked a pale yellow or a near-black navy — so only the *hue* survives, and the
 * lightness and saturation are pinned to values a chessboard actually works at. The result follows
 * the workspace's colour without trusting it.
 *
 * The two lightnesses are roughly those of the boards everybody already plays on (lichess's brown
 * runs 83% against 55%), which is the whole reason black and white pieces read on both squares.
 */

export type BoardColours = { light: string; dark: string }

/** Starhive blue, for a theme whose primary cannot be parsed. */
const FALLBACK: BoardColours = { light: '#dde6f2', dark: '#5b82b5' }

const DARK_LIGHTNESS = 56
const LIGHT_LIGHTNESS = 89
/** Saturation bands wide enough to feel like the brand, narrow enough never to shout. */
const DARK_SATURATION = { min: 26, max: 50 }
const LIGHT_SATURATION = { min: 12, max: 30 }

type Hsl = { h: number; s: number; l: number }

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/** `#abc` and `#aabbcc`. Anything else is not something to guess at. */
export function hexToHsl(hex: string | undefined): Hsl | undefined {
  if (!hex) return undefined
  const cleaned = hex.trim().replace(/^#/, '')
  const full =
    cleaned.length === 3
      ? cleaned
          .split('')
          .map((character) => character + character)
          .join('')
      : cleaned
  if (!/^[0-9a-f]{6}$/i.test(full)) return undefined

  const r = parseInt(full.slice(0, 2), 16) / 255
  const g = parseInt(full.slice(2, 4), 16) / 255
  const b = parseInt(full.slice(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l: l * 100 }

  const delta = max - min
  const s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min)
  const h =
    max === r
      ? ((g - b) / delta + (g < b ? 6 : 0)) / 6
      : max === g
        ? ((b - r) / delta + 2) / 6
        : ((r - g) / delta + 4) / 6
  return { h: h * 360, s: s * 100, l: l * 100 }
}

export function hslToHex({ h, s, l }: Hsl): string {
  const saturation = clamp(s, 0, 100) / 100
  const lightness = clamp(l, 0, 100) / 100
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const hue = ((h % 360) + 360) % 360
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = lightness - chroma / 2

  const [r, g, b] =
    hue < 60
      ? [chroma, x, 0]
      : hue < 120
        ? [x, chroma, 0]
        : hue < 180
          ? [0, chroma, x]
          : hue < 240
            ? [0, x, chroma]
            : hue < 300
              ? [x, 0, chroma]
              : [chroma, 0, x]

  const channel = (value: number) =>
    Math.round((value + m) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${channel(r)}${channel(g)}${channel(b)}`
}

export function boardColours(primary: string | undefined): BoardColours {
  const hsl = hexToHsl(primary)
  if (!hsl) return FALLBACK
  // A grey brand colour has no hue worth keeping; the fallback blue is a better board than a grey
  // one, and a grey board is what "follow the theme" would literally have produced.
  if (hsl.s < 6) return FALLBACK
  return {
    light: hslToHex({
      h: hsl.h,
      s: clamp(hsl.s, LIGHT_SATURATION.min, LIGHT_SATURATION.max),
      l: LIGHT_LIGHTNESS,
    }),
    dark: hslToHex({
      h: hsl.h,
      s: clamp(hsl.s, DARK_SATURATION.min, DARK_SATURATION.max),
      l: DARK_LIGHTNESS,
    }),
  }
}
