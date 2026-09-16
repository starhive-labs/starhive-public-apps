import {
  createTheme,
  type CSSVariablesResolver,
  DEFAULT_THEME,
  type MantineColorsTuple,
  virtualColor,
} from '@mantine/core'

import {
  MANTINE_PALETTES_DARK,
  NEGATIVE_KEY,
  NEGATIVE_KEY_DARK,
  NEUTRAL_KEY,
  NEUTRAL_KEY_DARK,
  POSITIVE_KEY,
  POSITIVE_KEY_DARK,
  PRIMARY_KEY,
  PRIMARY_KEY_DARK,
  SECONDARY_KEY,
  SECONDARY_KEY_DARK,
  TEXT_AND_ICON,
  TEXT_AND_ICON_DARK,
  TRANSPARENT_KEY,
  WARNING_KEY,
  WARNING_KEY_DARK,
} from './colors'

/** Starhive's product font (load it in the app — `StarhiveAppProvider` injects it for you). */
export const FONT_FAMILY = 'Manrope, "Manrope Fallback", system-ui, sans-serif'

export const FONT_WEIGHTS = {
  LIGHT: 300,
  NORMAL: 500,
  SEMI_BOLD: 600,
  BOLD: 700,
} as const

declare module '@mantine/core' {
  export interface MantineThemeOther {
    fontWeights: typeof FONT_WEIGHTS
  }
}

const tuple = (...values: string[]): MantineColorsTuple => values as unknown as MantineColorsTuple

type LightDarkKey = Record<100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900, string>

// Registers `<name>` as a virtual color resolving to the light or dark tuple
// depending on the active color scheme (`theme.colors.<name>[n]` becomes
// `var(--mantine-color-<name>-n)`).
const schemeColor = (name: string, light: LightDarkKey, dark: LightDarkKey) => ({
  [name]: virtualColor({ name, light: `${name}Light`, dark: `${name}Dark` }),
  [`${name}Light`]: tuple(
    NEUTRAL_KEY.white,
    light[100],
    light[200],
    light[300],
    light[400],
    light[500],
    light[600],
    light[700],
    light[800],
    light[900],
  ),
  [`${name}Dark`]: tuple(
    NEUTRAL_KEY_DARK.white,
    dark[100],
    dark[200],
    dark[300],
    dark[400],
    dark[500],
    dark[600],
    dark[700],
    dark[800],
    dark[900],
  ),
})

/**
 * Starhive's Mantine theme — the single source of truth for tokens (colors, spacing, radii, shadows,
 * typography). Mirrors `platform-ui`'s theme so apps built with `@starhive/ui` match the product.
 */
export const starhiveTheme = createTheme({
  fontFamily: FONT_FAMILY,
  defaultRadius: 'md',
  primaryColor: 'primary',
  // Mantine defaults to shade 8 in dark mode; the palettes are designed so that
  // shade 6 is the main accent in both schemes.
  primaryShade: 6,
  // Reference virtual colors so black/white follow the color scheme: `black`
  // is the primary text color, `white` the base surface color.
  black: 'var(--mantine-color-text-5)',
  white: 'var(--mantine-color-neutral-0)',
  spacing: {
    none: '0',
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    xxl: '4rem',
  },
  shadows: {
    sm: '0px 2px 4px 0px rgba(149, 153, 168, 0.18)',
    md: '0px 7px 7px 0px rgba(149, 153, 168, 0.15), 0px 4px 2px 0px rgba(216, 218, 222, 0.05)',
    lg: '0px 15px 16px 0px rgba(149, 153, 168, 0.25), 6px 12px 12px 0px rgba(149, 153, 168, 0.18)',
  },
  fontSizes: {
    xs: '0.75rem',
    sm: '0.875rem',
    md: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    xxl: '2rem',
  },
  radius: {
    xs: '2px',
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '999px',
  },
  // The main color names are virtual: `theme.colors.<name>[n]` resolves to
  // `var(--mantine-color-<name>-n)`, which Mantine points at the *Light or
  // *Dark tuple depending on the active color scheme.
  colors: {
    text: virtualColor({ name: 'text', light: 'textLight', dark: 'textDark' }),
    textLight: tuple(
      TEXT_AND_ICON.disabled_white,
      TEXT_AND_ICON.secondary_white,
      TEXT_AND_ICON.primary_white,
      TEXT_AND_ICON.disabled_black,
      TEXT_AND_ICON.secondary_black,
      TEXT_AND_ICON.primary_black,
      '',
      '',
      '',
      '',
    ),
    textDark: tuple(
      TEXT_AND_ICON_DARK.disabled_white,
      TEXT_AND_ICON_DARK.secondary_white,
      TEXT_AND_ICON_DARK.primary_white,
      TEXT_AND_ICON_DARK.disabled_black,
      TEXT_AND_ICON_DARK.secondary_black,
      TEXT_AND_ICON_DARK.primary_black,
      '',
      '',
      '',
      '',
    ),
    ...schemeColor('neutral', NEUTRAL_KEY, NEUTRAL_KEY_DARK),
    ...schemeColor('primary', PRIMARY_KEY, PRIMARY_KEY_DARK),
    ...schemeColor('secondary', SECONDARY_KEY, SECONDARY_KEY_DARK),
    ...schemeColor('positive', POSITIVE_KEY, POSITIVE_KEY_DARK),
    ...schemeColor('warning', WARNING_KEY, WARNING_KEY_DARK),
    ...schemeColor('negative', NEGATIVE_KEY, NEGATIVE_KEY_DARK),
    // Mantine's own dark-scheme CSS rules (disabled inputs, hover states,
    // etc.) reference the built-in `dark` palette, which is a neutral gray
    // scale by default and clashes with the navy-tinted brand neutrals.
    // Override it; the palette is only used by dark-scheme rules, so the
    // light scheme is unaffected.
    dark: tuple(
      NEUTRAL_KEY_DARK[800],
      NEUTRAL_KEY_DARK[700],
      NEUTRAL_KEY_DARK[600],
      NEUTRAL_KEY_DARK[500],
      NEUTRAL_KEY_DARK[400],
      NEUTRAL_KEY_DARK[300],
      NEUTRAL_KEY_DARK[200],
      NEUTRAL_KEY_DARK[100],
      NEUTRAL_KEY_DARK.white,
      NEUTRAL_KEY[900],
    ),
    // The Mantine built-in palettes used for workflow-state colors are virtual too: light keeps
    // Mantine's own defaults verbatim, dark uses the dark-tuned variants from colors.ts.
    ...Object.fromEntries(
      Object.entries(MANTINE_PALETTES_DARK).flatMap(([name, darkTuple]) => [
        [name, virtualColor({ name, light: `${name}Light`, dark: `${name}Dark` })],
        [`${name}Light`, DEFAULT_THEME.colors[name]],
        [`${name}Dark`, darkTuple as unknown as MantineColorsTuple],
      ]),
    ),
    transparent: tuple(
      TRANSPARENT_KEY[6],
      TRANSPARENT_KEY[12],
      TRANSPARENT_KEY[16],
      TRANSPARENT_KEY[24],
      '',
      '',
      '',
      '',
      '',
      '',
    ),
  },
  other: {
    fontWeights: FONT_WEIGHTS,
  },
})

const SCHEME_COLOR_NAMES = [
  'neutral',
  'primary',
  'secondary',
  'positive',
  'warning',
  'negative',
] as const

export const themeResolver: CSSVariablesResolver = (theme) => ({
  variables: {
    '--mantine-other-fontWeights-light': theme.other.fontWeights.LIGHT.toString(),
    '--mantine-other-fontWeights-normal': theme.other.fontWeights.NORMAL.toString(),
    '--mantine-other-fontWeights-bold': theme.other.fontWeights.BOLD.toString(),
    '--mantine-other-fontWeights-semiBold': theme.other.fontWeights.SEMI_BOLD.toString(),
  },
  dark: {
    // Mantine's dark defaults use its built-in `dark` palette; point them at
    // the brand palettes instead.
    '--mantine-color-body': NEUTRAL_KEY_DARK.white,
    '--mantine-color-text': TEXT_AND_ICON_DARK.primary_black,
    '--mantine-color-placeholder': TEXT_AND_ICON_DARK.disabled_black,
    '--mantine-color-dimmed': TEXT_AND_ICON_DARK.secondary_black,
    '--mantine-color-default': NEUTRAL_KEY_DARK.white,
    '--mantine-color-default-hover': NEUTRAL_KEY_DARK[100],
    '--mantine-color-default-color': TEXT_AND_ICON_DARK.primary_black,
    '--mantine-color-default-border': NEUTRAL_KEY_DARK[300],
    '--mantine-color-anchor': PRIMARY_KEY_DARK[600],
    '--mantine-color-error': NEGATIVE_KEY_DARK[600],
    // Mantine hardcodes `--mantine-color-<name>-text` (what unshaded color
    // props like c="primary" resolve to) to shade 4 in the dark scheme, and
    // `--mantine-color-<name>-light-color` (what the `light` and `subtle`
    // variants draw their text and icons with) to shade 3. Our inverted dark
    // palettes use both of those as background tints, so such text came out
    // dim in the first case and very nearly invisible in the second - a
    // `subtle` button read as dark navy on a dark surface. Match the
    // light-scheme behavior instead: both follow -filled (shade 6), the accent
    // step in both schemes, which reads on the plain dark surface and on the
    // faint tint the `light` variant puts behind it.
    ...Object.fromEntries(
      [...SCHEME_COLOR_NAMES, ...Object.keys(MANTINE_PALETTES_DARK)].flatMap((name) => [
        [`--mantine-color-${name}-text`, `var(--mantine-color-${name}-filled)`],
        [`--mantine-color-${name}-light-color`, `var(--mantine-color-${name}-filled)`],
      ]),
    ),
    // The light shadows use a gray glow that looks odd on dark surfaces.
    '--mantine-shadow-sm': '0px 2px 4px 0px rgba(0, 0, 0, 0.35)',
    '--mantine-shadow-md':
      '0px 7px 7px 0px rgba(0, 0, 0, 0.35), 0px 4px 2px 0px rgba(0, 0, 0, 0.2)',
    '--mantine-shadow-lg':
      '0px 15px 16px 0px rgba(0, 0, 0, 0.45), 6px 12px 12px 0px rgba(0, 0, 0, 0.35)',
  },
  light: {},
})
