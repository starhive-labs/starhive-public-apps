import { Group, Stack, Text } from '@mantine/core'
import { useBridge } from '@starhive/bridge'
import { Badge, Button, Card } from '@starhive/ui'
import { useEffect, useState } from 'react'

/**
 * A system whose address only the customer knows.
 *
 * The app cannot name it: an HR system lives wherever that customer put it. So the manifest names
 * the *shape* it will accept - `configurable.patterns` - and an admin supplies the rest under
 * Settings → Apps → Manage → Connect. The app then calls it by key, exactly like any other remote,
 * and never learns the address.
 *
 * That last part is the point worth seeing: the response below shows which host was actually reached,
 * and the app only knows because the far end echoed it back.
 */
export function CustomerSystem() {
  const bridge = useBridge()
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    bridge
      .remotes()
      .then((remotes) => setConfigured(remotes.find((r) => r.key === 'hr-system')?.configured ?? false))
      .catch(() => setConfigured(false))
  }, [bridge])

  async function lookUp() {
    setBusy(true)
    setResult(null)
    try {
      // httpbin's /anything echoes the request, including the URL it was reached on - which is how
      // this app can show an address it was never told.
      const response = await bridge.fetch('hr-system', '/anything/employees?department=Engineering')
      if (!response.ok) {
        setResult(`Your HR system answered ${response.status}.`)
        return
      }
      const echoed = response.json<{ url?: string }>().url
      setResult(echoed ? `Reached ${echoed}` : 'Reached your HR system.')
    } catch (caught) {
      // Starhive refuses before anything is sent when no address has been given, or when the one
      // stored is no longer inside the app's declared patterns.
      setResult(caught instanceof Error ? caught.message : 'Could not reach your HR system.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <Stack gap="sm">
        <Group justify="space-between" align="center">
          <Text fw={600}>Your HR system</Text>
          {configured !== null && (
            <Badge variant={configured ? 'success' : 'default'}>
              {configured ? 'Connected' : 'Not connected'}
            </Badge>
          )}
        </Group>

        <Text size="sm" c="dimmed">
          This app does not know where your HR system lives. An admin points it at one under
          Settings → Apps → Manage → Connect, within the hosts the app declared.
        </Text>

        <Group>
          <Button onClick={() => void lookUp()} disabled={busy}>
            {busy ? 'Looking up…' : 'Look up employees'}
          </Button>
        </Group>

        {result && (
          <Text size="sm" c="dimmed">
            {result}
          </Text>
        )}
      </Stack>
    </Card>
  )
}
