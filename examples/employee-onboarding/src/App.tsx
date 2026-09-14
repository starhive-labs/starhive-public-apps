import { useStarhiveContext, useTheme } from '@starhive/bridge'
import { StarhiveAppProvider } from '@starhive/ui'

import { GlobalPage } from './slots/GlobalPage'
import { Macro } from './slots/Macro'
import { ObjectPanel } from './slots/ObjectPanel'
import { SettingsPage } from './slots/SettingsPage'
import { Widget } from './slots/Widget'
import { useApplyHostTheme } from './useApplyHostTheme'

function Screen() {
  const { slot } = useStarhiveContext()

  switch (slot) {
    case 'objectPanel':
      return <ObjectPanel />
    case 'widget':
      return <Widget />
    case 'settingsPage':
      return <SettingsPage />
    case 'macro':
      return <Macro />
    case 'globalPage':
    default:
      return <GlobalPage />
  }
}

/**
 * Single bundle, five entry points. The host mounts each manifest module at its
 * declared path but also tells us which slot we are via the handshake context,
 * so we render the matching screen off `context.slot`.
 *
 * Wrapped in `StarhiveAppProvider` (from the vendored `@starhive/ui` SDK), which owns the base theming —
 * Starhive's Mantine theme (light and dark), fonts and the host color scheme; `useApplyHostTheme`
 * layers the host's live colors on top, which is what lets a widget blend into its dashboard cell.
 * Every screen is built with `@starhive/ui` + Mantine primitives.
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
