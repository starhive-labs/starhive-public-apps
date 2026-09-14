import { useStarhiveContext, useTheme } from '@starhive/bridge'
import { useEffect } from 'react'

/**
 * Applies the host's live theme on top of Starhive's own Mantine theme.
 *
 * `StarhiveAppProvider` already handles light/dark: it takes `colorScheme` and `@starhive/theme`
 * carries a palette for each. So why this hook?
 *
 * Because the host doesn't only tell us *which* scheme — it sends the actual colors in
 * `context.theme`, and for some slots those are deliberately not the workspace defaults. A `widget`
 * is handed `background: 'transparent'` (the dashboard cell behind it already painted itself, and the
 * iframe is meant to blend into it) plus that cell's configured foreground as `text`. Nothing picks
 * those up unless the app applies them — an app that ignores `theme.colors` renders an opaque panel
 * sitting on someone's dashboard, in whichever scheme.
 *
 * Written as inline custom properties on `:root`, which beat the stylesheet rules Mantine emits, so
 * a value the host sends wins and anything it omits keeps the theme's own light/dark value.
 */
export function useApplyHostTheme(): void {
  const theme = useTheme()
  const { slot } = useStarhiveContext()

  useEffect(() => {
    const root = document.documentElement
    /*
     * A panel is a lifted surface, not a page.
     *
     * The host sends two grounds: `background`, which a light page sits *below* its cards on, and
     * `surface`, which the cards themselves are. A full page wants the first — that is what every
     * Starhive page looks like. But the object panel is a narrow drawer already lifted above the
     * page, and painting it page-grey put grey gutters down both sides of a 380px column and made
     * the drawer look like a page that had been squeezed. So it takes `surface`: white in light,
     * lifted near-black in dark, from the host's own tokens either way rather than a hardcoded
     * colour that would come out white in dark mode.
     */
    const ground = slot === 'objectPanel' ? theme.colors.surface : theme.colors.background
    const overrides: Record<string, string | undefined> = {
      '--mantine-color-body': ground,
      '--mantine-color-text': theme.colors.text,
      '--mantine-color-dimmed': theme.colors.textMuted,
      '--mantine-color-default-border': theme.colors.border,
    }

    for (const [name, value] of Object.entries(overrides)) {
      if (value) root.style.setProperty(name, value)
    }
    // Hand the scheme's own values back if this app is ever unmounted without the page going away.
    return () => {
      for (const name of Object.keys(overrides)) root.style.removeProperty(name)
    }
  }, [theme, slot])
}
