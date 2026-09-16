// Starhive's color palette — the canonical values shared by platform-ui and the @starhive/ui SDK.
// Keep in sync with the design source (Figma Foundation).

export const NEUTRAL_KEY = {
  900: '#12141F',
  800: '#1F2233',
  700: '#4E5473',
  600: '#696E8A',
  500: '#9CA1BA',
  400: '#C5C8D6',
  300: '#DDDFEB',
  200: '#EDEFF7',
  100: '#F7F8FC',
  white: '#FFFFFF',
} as const

export const PRIMARY_KEY = {
  900: '#202F7A',
  800: '#3046B8',
  700: '#3E5CF0',
  600: '#4968FF',
  500: '#6D84FF',
  400: '#B7C2F7',
  300: '#DBE1FF',
  200: '#E8EBFC',
  100: '#F5F7FF',
} as const

export const SECONDARY_KEY = {
  900: '#245553',
  800: '#237A77',
  700: '#25B8B3',
  600: '#33D9D5',
  500: '#7EE0DE',
  400: '#B6F0EE',
  300: '#CEF5F3',
  200: '#E6FAF9',
  100: '#F2FCFC',
} as const

export const POSITIVE_KEY = {
  900: '#1D6138',
  800: '#1D733F',
  700: '#1B8746',
  600: '#37AD67',
  500: '#62CC8C',
  400: '#8EE5B1',
  300: '#C4F5D7',
  200: '#E1FAEB',
  100: '#F5FFF9',
} as const

export const WARNING_KEY = {
  900: '#6E552F',
  800: '#8A5B15',
  700: '#A36810',
  600: '#D68D1E',
  500: '#FABC5F',
  400: '#FACC87',
  300: '#FAE4C3',
  200: '#FAEEDC',
  100: '#FFFBF5',
} as const

export const NEGATIVE_KEY = {
  900: '#991C24',
  800: '#BA252F',
  700: '#DE2C38',
  600: '#F54E59',
  500: '#FA7D85',
  400: '#F0A3A8',
  300: '#FACDD0',
  200: '#FAE6E7',
  100: '#FFF5F5',
} as const

export const TEXT_AND_ICON = {
  disabled_white: '#F9F9FC',
  secondary_white: '#F5F6FA',
  primary_white: '#CED1E0',
  disabled_black: '#696E8A',
  secondary_black: '#4E5473',
  primary_black: '#0C0F1F',
} as const

// Dark color scheme palettes. Semantics mirror the light palettes with inverted
// luminance: low steps stay usable as subtle backgrounds and high steps as text,
// in both schemes. Values mirror platform-ui's theme/colors.ts.
export const NEUTRAL_KEY_DARK = {
  900: '#F2F3FA',
  800: '#DFE2EE',
  700: '#C0C4D6',
  600: '#9CA1BA',
  500: '#7A80A0',
  400: '#454C6E',
  300: '#343A57',
  200: '#282D45',
  100: '#1E2233',
  white: '#151824',
} as const

export const PRIMARY_KEY_DARK = {
  900: '#DBE1FF',
  800: '#B7C2F7',
  700: '#8FA3FF',
  600: '#6D84FF',
  500: '#5C74F5',
  400: '#3D51B3',
  300: '#2C3A80',
  200: '#232B57',
  100: '#1C2140',
} as const

export const SECONDARY_KEY_DARK = {
  900: '#CEF5F3',
  800: '#9EEEEC',
  700: '#66E3E0',
  600: '#33D9D5',
  500: '#25B8B3',
  400: '#20706D',
  300: '#1D4C4A',
  200: '#173836',
  100: '#132B2A',
} as const

export const POSITIVE_KEY_DARK = {
  900: '#D5F7E3',
  800: '#A8EBC4',
  700: '#79D9A0',
  600: '#4FC57E',
  500: '#37AD67',
  400: '#1F6B41',
  300: '#1D4C30',
  200: '#173824',
  100: '#122B1C',
} as const

export const WARNING_KEY_DARK = {
  900: '#FAE9C9',
  800: '#FAD394',
  700: '#FABC5F',
  600: '#F0A63C',
  500: '#D68D1E',
  400: '#7A5A22',
  300: '#54401D',
  200: '#3B2D16',
  100: '#2B2112',
} as const

export const NEGATIVE_KEY_DARK = {
  900: '#FAD2D5',
  800: '#F7A9AE',
  700: '#FA7D85',
  600: '#F55E68',
  500: '#E04853',
  400: '#8A2830',
  300: '#5E2026',
  200: '#47191E',
  100: '#331418',
} as const

// The *_white steps render on colored/dark surfaces and stay the same in both
// schemes; the *_black steps flip to light text for dark surfaces.
export const TEXT_AND_ICON_DARK = {
  disabled_white: TEXT_AND_ICON.disabled_white,
  secondary_white: TEXT_AND_ICON.secondary_white,
  primary_white: TEXT_AND_ICON.primary_white,
  disabled_black: '#666C8C',
  secondary_black: '#A9AEC6',
  primary_black: '#E8EAF5',
} as const

const transparencyBaseRGB = '124, 137, 203'
export const TRANSPARENT_KEY = {
  6: `rgba(${transparencyBaseRGB},0.06)`,
  12: `rgba(${transparencyBaseRGB},0.12)`,
  16: `rgba(255,255,255,0.16)`,
  24: `rgba(${transparencyBaseRGB}, 0.24)`,
} as const

// Dark variants of the Mantine built-in palettes used for workflow-state colors (see COLOR_MAP
// in @starhive/attributes' StateBadge, and platform-ui's ui/StateBadge.tsx). Same
// inverted-luminance semantics as the palettes above: low steps are dark tinted backgrounds,
// step 6 stays a legible accent, high steps become light text tints. The light variants are
// Mantine's DEFAULT_THEME values (wired in theme.ts), so the light scheme is unchanged.
//
// Copied from platform-ui's theme/colors.ts, where the values were design-reviewed. Without
// them an app's workflow badges kept their light-scheme colors in dark mode.
export const MANTINE_PALETTES_DARK: Record<string, readonly string[]> = {
  gray: [
    '#232838',
    '#2A2F42',
    '#333950',
    '#404763',
    '#525A7A',
    '#7A8099',
    '#9CA3B8',
    '#C2C6D4',
    '#DCDFE8',
    '#F0F1F6',
  ],
  red: [
    '#391B20',
    '#472026',
    '#5A262E',
    '#752E38',
    '#A03A44',
    '#D14B55',
    '#FA5252',
    '#FF7B81',
    '#FFA8AC',
    '#FFD3D5',
  ],
  green: [
    '#16301F',
    '#1A3A25',
    '#20492E',
    '#285D3A',
    '#33804C',
    '#3AA35D',
    '#40C057',
    '#6ED584',
    '#A3E8B0',
    '#D3F6DA',
  ],
  blue: [
    '#16283C',
    '#1A304A',
    '#1F3C5E',
    '#264D7A',
    '#2F63A0',
    '#3B7FC9',
    '#4DA3F5',
    '#79BCFA',
    '#A9D4FC',
    '#D5EAFE',
  ],
  yellow: [
    '#332B12',
    '#403514',
    '#524318',
    '#6B571D',
    '#8F7422',
    '#C49B1D',
    '#FAB005',
    '#FDC94E',
    '#FEDF8F',
    '#FFF0C7',
  ],
  orange: [
    '#392413',
    '#472B15',
    '#5A351A',
    '#754320',
    '#A05827',
    '#D06C1E',
    '#FD7E14',
    '#FF9E4D',
    '#FFC28A',
    '#FFE2C7',
  ],
  grape: [
    '#2F1B36',
    '#3A2143',
    '#4A2955',
    '#5F336E',
    '#7E4292',
    '#A44FBE',
    '#C55FDF',
    '#D68AEA',
    '#E5B4F2',
    '#F3DBF9',
  ],
}
