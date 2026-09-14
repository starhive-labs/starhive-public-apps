import { useStarhiveContext, useTheme } from '@starhive/bridge'
import { StarhiveAppProvider } from '@starhive/ui'

import { GlobalPage } from './slots/GlobalPage'
import { Macro } from './slots/Macro'
import { ObjectPanel } from './slots/ObjectPanel'
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
    case 'macro':
      return <Macro />
    case 'globalPage':
    default:
      return <GlobalPage />
  }
}

export function App() {
  const { colorScheme } = useTheme()
  useApplyHostTheme()

  return (
    <StarhiveAppProvider colorScheme={colorScheme}>
      <Screen />
    </StarhiveAppProvider>
  )
}
