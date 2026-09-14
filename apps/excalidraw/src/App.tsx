import { Text } from '@mantine/core'
import { useStarhiveContext, useTheme } from '@starhive/bridge'
import { StarhiveAppProvider } from '@starhive/ui'

import { DiagramMacro } from './slots/DiagramMacro'
import { useApplyHostTheme } from './useApplyHostTheme'

function Screen() {
  const { slot } = useStarhiveContext()

  // The manifest declares one module, in the macro slot. Anything else means the app was mounted
  // somewhere it does not claim to work, so it says so rather than rendering a canvas out of context.
  switch (slot) {
    case 'macro':
      return <DiagramMacro />
    default:
      return (
        <Text size="sm" c="dimmed" p="md">
          Excalidraw runs as a diagram block inside a page. Insert one from the editor’s “/” menu.
        </Text>
      )
  }
}

/**
 * App root. `StarhiveAppProvider` (from the vendored `@starhive/ui` SDK) owns all theming — Starhive's
 * Mantine theme, fonts and the host colour scheme — so the block matches the page it sits in.
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
