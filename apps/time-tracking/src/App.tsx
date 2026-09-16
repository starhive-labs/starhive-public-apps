import { useStarhiveContext, useTheme } from '@starhive/bridge'
import { StarhiveAppProvider } from '@starhive/ui'

import { GlobalPage } from './slots/GlobalPage'
import { ObjectPanel } from './slots/ObjectPanel'
import { SettingsPage } from './slots/SettingsPage'
import { Widget } from './slots/Widget'
import { useApplyHostTheme } from './useApplyHostTheme'

/** One bundle serves every module; `context.slot` says which screen this frame is. */
function Screen() {
  const { slot } = useStarhiveContext()

  switch (slot) {
    case 'objectPanel':
      return <ObjectPanel />
    case 'widget':
      return <Widget />
    case 'settingsPage':
      return <SettingsPage />
    case 'globalPage':
    default:
      return <GlobalPage />
  }
}

/**
 * Wrapped in `StarhiveAppProvider` (from the vendored `@starhive/ui`), which owns the base theming —
 * Starhive's Mantine theme in light and dark, the font, the host colour scheme. `useApplyHostTheme`
 * layers the host's live colours on top, which is what lets the widget blend into its dashboard cell.
 */
export function App() {
  const { colorScheme } = useTheme()
  useApplyHostTheme()

  return (
    <StarhiveAppProvider colorScheme={colorScheme}>
      <Screen />
    </StarhiveAppProvider>
  )
}
