import { useTheme } from '@starhive/bridge'
import { StarhiveAppProvider } from '@starhive/ui'

import { GlobalPage } from './slots/GlobalPage'
import { useApplyHostTheme } from './useApplyHostTheme'

/**
 * One module, so no dispatch on `context.slot`.
 *
 * The app used to mount into four surfaces and branch here on which one this frame was. The other
 * three are gone; if one comes back, the switch comes back with it.
 */
export function App() {
  const { colorScheme } = useTheme()
  useApplyHostTheme()

  return (
    <StarhiveAppProvider colorScheme={colorScheme}>
      <GlobalPage />
    </StarhiveAppProvider>
  )
}
