import { useBridge } from '@starhive/bridge'
import { useEffect, useState } from 'react'

/**
 * Whether a declared remote can be **called** right now.
 *
 * Exactly that, and nothing more. `configured` is true as soon as the host has an address to send to,
 * which for a remote whose manifest fixes its `baseUrl` and needs no credential is always — GitLab
 * answers plenty of requests anonymously. It does **not** mean an admin has stored a token, and the
 * bridge gives an app no way to ask: `BridgeRemote` is `{ key, name, configured }`.
 *
 * So a private project fails at the call, not here, and the message the reader needs comes from
 * GitLab's own 401/403/404 — see `message()` in the GitLab client. Calling this "connected" claimed
 * something no one had done.
 *
 * `null` while the answer is still unknown, so a panel can wait rather than flash the wrong thing.
 */
export function useRemoteStatus(remoteKey: string): boolean | null {
  const bridge = useBridge()
  const [configured, setConfigured] = useState<boolean | null>(null)

  useEffect(() => {
    let active = true
    bridge
      .remotes()
      .then((remotes) => {
        if (active) setConfigured(remotes.find((r) => r.key === remoteKey)?.configured ?? false)
      })
      .catch(() => active && setConfigured(false))
    return () => {
      active = false
    }
  }, [bridge, remoteKey])

  return configured
}
