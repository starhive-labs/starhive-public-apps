import { useStarhiveContext, useTheme } from '@starhive/bridge'
import { StarhiveAppProvider } from '@starhive/ui'

import { GlobalPage } from './slots/GlobalPage'
import { ObjectPanel } from './slots/ObjectPanel'
import { SettingsPage } from './slots/SettingsPage'
import { useApplyHostTheme } from './useApplyHostTheme'

function Screen() {
  const { slot } = useStarhiveContext()

  switch (slot) {
    case 'objectPanel':
      return <ObjectPanel />
    case 'settingsPage':
      return <SettingsPage />
    case 'globalPage':
    default:
      return <GlobalPage />
  }
}

/**
 * One bundle, three entry points. The host mounts each manifest module at the same route and tells us
 * which slot we are through the handshake, so the screen comes off `context.slot`.
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
