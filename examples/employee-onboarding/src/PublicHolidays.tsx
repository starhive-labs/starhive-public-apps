import { Group, Stack, Text } from '@mantine/core'
import { useBridge, useStarhiveContext } from '@starhive/bridge'
import { Badge, Button, Card } from '@starhive/ui'
import { useEffect, useState } from 'react'

type Holiday = { date: string; localName: string; name: string }

/**
 * Onboarding runs into public holidays, so this app asks a public calendar about them.
 *
 * It is the app's whole relationship with the outside world, and it shows the shape of one: the
 * manifest declares the system under a key (`holidays`), an admin connects it in Starhive, and the
 * app calls it by that key and a path. The app never knows the address, never holds a credential,
 * and cannot reach anything its manifest did not name.
 */
export function PublicHolidays() {
  const bridge = useBridge()
  const { user } = useStarhiveContext()
  const [holidays, setHolidays] = useState<Holiday[] | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'unconnected' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  /*
   * Asking first is the difference between "an admin still has to connect this" and an unexplained
   * failure. `configured` answers exactly one question — can this call be made — so the label says
   * that and nothing more. Calling it "Connected" claimed an admin had set something up, which for a
   * remote whose manifest fixes the address and needs no credential is not true, and contradicted
   * what Starhive's own settings screen said about the same system.
   */
  const [reachable, setReachable] = useState<boolean | null>(null)
  useEffect(() => {
    bridge
      .remotes()
      .then((remotes) => setReachable(remotes.find((r) => r.key === 'holidays')?.configured ?? false))
      .catch(() => setReachable(false))
  }, [bridge])

  const [credential, setCredential] = useState<string | null>(null)

  /**
   * Proof that the credential is Starhive's, not the app's.
   *
   * httpbin's /bearer answers 200 only when an Authorization: Bearer header arrived. This app never
   * sets one - it cannot, the proxy strips it - so a 200 here means Starhive wrote the key an admin
   * stored onto the request on its way out.
   */
  async function checkCredential() {
    setCredential('Checking…')
    try {
      const response = await bridge.fetch('echo', '/bearer')
      setCredential(
        response.ok
          ? 'Starhive added the stored key to the request (200 from httpbin).'
          : `No credential reached httpbin (${response.status}). Connect it under Settings → Apps.`,
      )
    } catch (caught) {
      setCredential(caught instanceof Error ? caught.message : 'Could not reach httpbin.')
    }
  }

  async function load() {
    setStatus('loading')
    setMessage(null)
    try {
      // Country code is illustrative; a real app would take it from config or the hire's record.
      const response = await bridge.fetch('holidays', '/api/v3/PublicHolidays/2026/SE')
      if (!response.ok) {
        setStatus('error')
        setMessage(`The calendar answered ${response.status}.`)
        return
      }
      setHolidays(response.json<Holiday[]>().slice(0, 5))
      setStatus('idle')
    } catch (caught) {
      // A refusal from Starhive (not connected, address not allowed) arrives here.
      setStatus('unconnected')
      setMessage(caught instanceof Error ? caught.message : 'Could not reach the calendar.')
    }
  }

  return (
    <Card>
      <Stack gap="sm">
        <Group justify="space-between" align="center">
          <Text fw={600}>Public holidays</Text>
          {reachable !== null && (
            <Badge variant={reachable ? 'success' : 'default'}>
              {reachable ? 'Ready' : 'Needs connecting'}
            </Badge>
          )}
        </Group>

        <Text size="sm" c="dimmed">
          Upcoming days off {user.name ? `for ${user.name}'s` : 'for a'} new hires to plan around,
          fetched live from a public calendar through Starhive.
        </Text>

        <Group>
          <Button onClick={() => void load()} disabled={status === 'loading'}>
            {status === 'loading' ? 'Checking…' : 'Check holidays'}
          </Button>
          <Button variant="secondary" onClick={() => void checkCredential()}>
            Check credential
          </Button>
        </Group>

        {credential && (
          <Text size="sm" c="dimmed">
            {credential}
          </Text>
        )}

        {message && (
          <Text size="sm" c={status === 'unconnected' ? 'dimmed' : 'negative.6'}>
            {message}
          </Text>
        )}

        {holidays?.map((holiday) => (
          <Group key={holiday.date} justify="space-between">
            <Text size="sm">{holiday.localName}</Text>
            <Text size="sm" c="dimmed">
              {holiday.date}
            </Text>
          </Group>
        ))}
      </Stack>
    </Card>
  )
}
