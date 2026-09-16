import { useTheme } from '@starhive/bridge'
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
 *
 * **`background` and `surface` are a pair, and which is which matters.** The host sends the page
 * colour as `background` and the colour of the cards on it as `surface` — in light mode a near-white
 * page under white cards, in dark mode a dark page under *lighter* cards. Mantine spends
 * `--mantine-color-body` on both jobs: it is the `body` background and it is also what `Paper` (so
 * `Card`, and every input) paints itself with. Pointing that one variable at `background` therefore
 * painted every card in the page's colour, which is why the app's cards came out grey while the page
 * behind them stayed white. So the variable takes `surface`, and the page is painted separately.
 *
 * A `widget` is handed `background: 'transparent'` and keeps it: the body stays see-through and the
 * dashboard cell shows through, exactly as before.
 */
export function useApplyHostTheme(): void {
  const theme = useTheme()

  useEffect(() => {
    const root = document.documentElement
    const overrides: Record<string, string | undefined> = {
      // Cards, inputs and every other Paper — not the page. See above.
      '--mantine-color-body': theme.colors.surface,
      '--mantine-color-text': theme.colors.text,
      '--mantine-color-dimmed': theme.colors.textMuted,
      '--mantine-color-default-border': theme.colors.border,
    }

    for (const [name, value] of Object.entries(overrides)) {
      if (value) root.style.setProperty(name, value)
    }

    // The page itself. Inline, because Mantine's own `body` rule points at the variable above and
    // would otherwise paint the page in the cards' colour.
    if (theme.colors.background) document.body.style.background = theme.colors.background

    // Hand the scheme's own values back if this app is ever unmounted without the page going away.
    // The inline background is removed rather than restored to what it was: what it was is whatever
    // the previous run of this effect set, and dropping it falls through to the stylesheet.
    return () => {
      for (const name of Object.keys(overrides)) root.style.removeProperty(name)
      document.body.style.removeProperty('background')
    }
  }, [theme])
}
