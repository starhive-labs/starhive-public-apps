import { Stack, Text } from '@mantine/core'
import { useAttributes, useBridge, useObjects, useToast } from '@starhive/bridge'
import { Button, TextInput } from '@starhive/ui'
import { useMemo, useState } from 'react'

import { invalidate } from './cache'
import { ATTR, CODE_LINK_KEY, type LinkTarget, targetAttributes } from './codeLink'
import { locateUrl } from './providers'

/**
 * Link something by pasting its URL.
 *
 * The URL is read locally (which provider, which project, what kind of thing) and then *verified*
 * against GitLab before anything is stored, so a typo fails here rather than becoming a row that
 * never resolves. What gets stored is the identity plus whatever GitLab said at that moment — the
 * link's own copy, shown whenever a later live read cannot be made.
 */
export function LinkForm({
  target,
  reachable,
  onLinked,
}: {
  /** The work item the pasted URL is linked to. */
  target: LinkTarget
  reachable: boolean
  onLinked: () => void
}) {
  const bridge = useBridge()
  const objects = useObjects()
  const toast = useToast()
  const columns = useAttributes(CODE_LINK_KEY, Object.values(ATTR))

  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const attributeIdOf = useMemo(() => {
    const byKey = new Map(columns.data.map((column) => [column.key ?? column.name, column.id]))
    return (key: string) => byKey.get(key)
  }, [columns.data])

  async function link() {
    setBusy(true)
    setError(null)
    try {
      const found = locateUrl(url)
      if (!found?.locator) {
        setError('That is not a GitLab merge request, branch or commit URL.')
        return
      }
      const { provider, locator } = found

      // Two steps that fail for unrelated reasons, so they are caught apart. Rolled into one
      // `catch`, a refused write read as "GitLab said no" — which sent someone looking at GitLab for
      // a problem in Starhive.
      let state
      try {
        // Someone pasting a URL has just been looking at the thing in GitLab, so a cached answer from
        // minutes ago is exactly the wrong one to verify against.
        invalidate(`/api/v4/projects/${encodeURIComponent(locator.project)}`)
        // Verified before it is stored: a link that cannot be read is a link that will never render.
        state = await provider.read(bridge, locator)
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'GitLab could not be read.')
        return
      }

      const value = (key: string, text: string) => {
        const id = attributeIdOf(key)
        return id && text ? [{ attributeId: id, values: [text] }] : []
      }

      const missing = [ATTR.title, ATTR.workItemId, ATTR.project, ATTR.kind, ATTR.ref].filter(
        (key) => !attributeIdOf(key),
      )
      if (missing.length > 0) {
        // The type is not the one this build expects — an upgrade that did not finish, or a manifest
        // and an install that have drifted. Worth saying, because the write would fail as a bare 400.
        setError(`This app's Code Link type is missing: ${missing.join(', ')}.`)
        return
      }

      try {
        await objects.create(CODE_LINK_KEY, [
          ...value(ATTR.title, state.title),
          ...targetAttributes(target, value),
          ...value(ATTR.project, locator.project),
          ...value(ATTR.kind, locator.kind),
          ...value(ATTR.ref, locator.ref),
          ...value(ATTR.url, state.url),
          ...value(ATTR.state, state.state),
          ...value(ATTR.author, state.author ?? ''),
        ])
      } catch (caught) {
        const detail = caught instanceof Error ? caught.message : 'unknown error'
        // GitLab was fine, so this is Starhive's refusal, and saying only its code sends someone to
        // re-check the URL they pasted. The usual reason is permission: a link is saved as the person
        // creating it, in the app's own GitLab space.
        setError(
          `GitLab was read fine, but Starhive refused to save the link: ${detail}. Links are saved as ` +
            'you, in the app’s GitLab space — if you cannot create objects there, an admin can give ' +
            'you access to it.',
        )
        return
      }

      setUrl('')
      toast('Linked', 'success')
      onLinked()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Stack gap="xs">
      <TextInput
        label="Paste a GitLab URL"
        description="A merge request, branch or commit that was not started from here."
        placeholder="https://gitlab.com/group/project/-/merge_requests/42"
        value={url}
        onChange={(event) => setUrl(event.currentTarget.value)}
      />
      {!reachable && (
        <Text size="xs" c="dimmed">
          GitLab is not reachable, so a URL cannot be checked. An admin connects it under Settings →
          Apps.
        </Text>
      )}
      {error && (
        <Text size="xs" c="red">
          {error}
        </Text>
      )}
      <Button onClick={link} disabled={!url.trim() || busy || !reachable}>
        {busy ? 'Checking…' : 'Link'}
      </Button>
    </Stack>
  )
}
