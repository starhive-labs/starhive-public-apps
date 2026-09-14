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
 */
export function useApplyHostTheme(): void {
  const theme = useTheme()

  useEffect(() => {
    const root = document.documentElement
    const overrides: Record<string, string | undefined> = {
      '--mantine-color-body': theme.colors.background,
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
  }, [theme])
}
