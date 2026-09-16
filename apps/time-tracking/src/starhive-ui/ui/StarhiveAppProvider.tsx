import '@mantine/core/styles.css'
// The attribute date fields use `@mantine/dates`, whose styles are a separate sheet. Loading it here
// means an app gets a themed Starhive date picker without importing anything itself.
import '@mantine/dates/styles.css'

import { ColorSchemeScript, MantineProvider } from '@mantine/core'
import { emotionTransform, MantineEmotionProvider } from '@mantine/emotion'
import { starhiveTheme, themeResolver } from '@starhive/theme'
import { type ReactNode, useEffect } from 'react'

/**
 * The metric-matched stand-in for Manrope, as the product itself defines it.
 *
 * Local, so it costs no request and cannot be blocked: `local('Arial')` with Manrope's own vertical
 * metrics, which is what keeps line heights and text widths the same as the page around the app.
 * Copied from platform-ui's `index.html` — the same three numbers, deliberately, since a fallback
 * that is metrically *near* Manrope is worse than one that matches it.
 */
const MANROPE_FALLBACK_FACE = `
@font-face {
  font-family: 'Manrope Fallback';
  src: local('Arial');
  ascent-override: 102.9626%;
  descent-override: 28.9763%;
  size-adjust: 103.5327%;
}`

const MANROPE_HREF =
  'https://fonts.googleapis.com/css2?family=Manrope:wght@300;500;600;700&display=swap'

/**
 * Give the app the font the product is set in, and something correct to use until it arrives.
 *
 * Both halves matter. The stylesheet brings real Manrope — the bundle CSP allows `fonts.googleapis.com`
 * for it and `fonts.gstatic.com` for the files it points at, because the product's own HTML loads the
 * same font from the same two hosts on every page. The `@font-face` is the metric-matched stand-in
 * the theme names between Manrope and `system-ui`, and it is declared here because it is otherwise
 * declared only in the product's HTML — outside the iframe, where an app cannot see it.
 *
 * Without the face, a blocked or slow stylesheet dropped the app all the way to `system-ui` with none
 * of the metric corrections, so the text in an app reflowed differently from the page around it. With
 * it, the worst case is Arial at Manrope's metrics, which is the same worst case the product has.
 */
function useStarhiveFont(): void {
  useEffect(() => {
    if (document.getElementById('starhive-font-manrope')) return

    // The fallback face first: it costs no request, so it is ready before the stylesheet resolves.
    const style = document.createElement('style')
    style.id = 'starhive-font-manrope'
    style.textContent = MANROPE_FALLBACK_FACE
    document.head.appendChild(style)

    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = MANROPE_HREF
    document.head.appendChild(link)
  }, [])
}

/**
 * Wrap a Starhive app in this once (at the root, inside the bridge's Suspense boundary) to get
 * Starhive's theme, fonts and component styling. Pass the host's color scheme — e.g. from the bridge:
 *
 * ```tsx
 * import { useTheme } from '@starhive/bridge'
 * <StarhiveAppProvider colorScheme={useTheme().colorScheme}>…</StarhiveAppProvider>
 * ```
 */
export function StarhiveAppProvider({
  children,
  colorScheme = 'light',
}: {
  children: ReactNode
  /** Host color scheme; pass `useTheme().colorScheme` from `@starhive/bridge` to track the workspace. */
  colorScheme?: 'light' | 'dark'
}) {
  useStarhiveFont()
  return (
    <>
      <ColorSchemeScript defaultColorScheme={colorScheme} />
      <MantineProvider
        defaultColorScheme={colorScheme}
        forceColorScheme={colorScheme}
        theme={starhiveTheme}
        cssVariablesResolver={themeResolver}
        stylesTransform={emotionTransform}
      >
        <MantineEmotionProvider>{children}</MantineEmotionProvider>
      </MantineProvider>
    </>
  )
}
