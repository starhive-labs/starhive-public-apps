import { Group, Stack, Text } from '@mantine/core'
import { useConfig, useStarhiveContext } from '@starhive/bridge'
import { Button, Card } from '@starhive/ui'
import { useState } from 'react'

import { BranchSection } from '../BranchSection'
import { InfoDot } from '../InfoDot'
import { SectionDivider } from '../SectionDivider'
import { invalidateAll } from '../cache'
import { readConfig } from '../codeLink'
import { searchTermFor } from '../discover'
import { LinkForm } from '../LinkForm'
import { LinkList } from '../LinkList'
import { useReloadAfterIndex } from '../useReloadAfterIndex'
import { useRemoteStatus } from '../useRemoteStatus'
import { useWorkItem } from '../useWorkItem'

/**
 * The code behind the object being viewed.
 *
 * Laid out as the work goes rather than as the data model: the branch first, then what came of it,
 * and the offer that matters right now — start a branch when there is none, open a merge request once
 * there is one. Pasting a URL is the escape hatch for everything that does not start here, so it is
 * behind a disclosure: it was the loudest thing on an empty panel, which pointed people at the one
 * action they were least likely to want.
 *
 * Carries no heading of its own. The drawer it opens in is already titled with the app's name, and
 * a panel that repeats it spends the top of a 380px column saying what the line above it just said.
 *
 * It reads the object it is mounted on, once, and passes what it learned down. Two things need it
 * and they need the same answer: a branch is named after the work item, and the work item's key is
 * what GitLab is searched for. The read is allowed because the app's own link type holds a reference
 * to this type — see `useWorkItem` — and a type with no key simply yields none of this.
 */
export function ObjectPanel() {
  const { objectId } = useStarhiveContext()
  const { config, isLoading } = useConfig()
  const reachable = useRemoteStatus('gitlab')
  const workItem = useWorkItem(objectId)
  const { key, pending, reload } = useReloadAfterIndex()
  const [linkingByUrl, setLinkingByUrl] = useState(false)
  /** null until the list has loaded — so the offer is never shown on a guess. */
  const [branchCount, setBranchCount] = useState<number | null>(null)

  if (!objectId) {
    return (
      <Stack gap="md" px="lg" pt="xs" pb="lg">
        <Text size="sm" c="dimmed">
          Not available here.
        </Text>
      </Stack>
    )
  }

  if (isLoading || reachable === null) {
    return (
      <Stack gap="md" px="lg" pt="xs" pb="lg">
        <Text size="sm" c="dimmed">
          Loading…
        </Text>
      </Stack>
    )
  }

  const { projects, branchNaming } = readConfig(config)

  /*
   * What GitLab is searched for, or nothing.
   *
   * Undefined on a type with no SEQUENCE, and on a sequence whose values are too thin to identify
   * anything — the panel then behaves exactly as it did before, filling in only from branches it was
   * told about. Held back while the read is in flight rather than searched for `undefined`: the
   * effect that uses it re-runs when it arrives.
   */
  const searchKey = workItem.isLoading ? undefined : searchTermFor(workItem.sequence)

  // Only `reload()`: it waits out the search index before remounting the list, and the list is what
  // reports whether a branch exists. Refetching anything here would ask before the write is visible.
  const changed = () => reload()

  const refresh = () => {
    invalidateAll()
    reload()
  }

  return (
    <Stack gap="md" px="lg" pt="xs" pb="lg">
      {/*
        Answers from GitLab are cached for a few minutes so that opening a work item twice costs
        nothing. That makes a panel able to be behind, which is only acceptable with a way to say
        "no, look again" — so this throws the cache away and re-reads.

        With the heading gone it sits alone in the top corner, tucked up under the drawer's own title
        rather than opening a section of its own — it is a control, not the first thing to read.
      */}
      <Group justify="flex-end" mb={-8}>
        <Button variant="quiet" size="compact-xs" onClick={refresh}>
          Refresh
        </Button>
      </Group>

      {pending && (
        <Text size="sm" c="dimmed">
          Updating…
        </Text>
      )}

      <LinkList
        key={key}
        workItemId={objectId}
        reachable={reachable}
        projects={projects}
        searchKey={searchKey}
        keyProblem={workItem.problem}
        onChanged={changed}
        onLoaded={({ branchCount: found }) => setBranchCount(found)}
        // Where the branches end: the offer to start another belongs with them, not stranded under
        // the merge requests that came out of the first one.
        afterBranches={
          branchCount === null ? null : branchCount === 0 ? (
            <Card>
              <BranchSection
                workItemId={objectId}
                workItem={workItem}
                projects={projects}
                branchNaming={branchNaming}
                branchCount={branchCount}
                onChanged={changed}
              />
            </Card>
          ) : (
            // No card: an offer that is not the next step should not look like one.
            <BranchSection
              workItemId={objectId}
              workItem={workItem}
              projects={projects}
              branchNaming={branchNaming}
              branchCount={branchCount}
              onChanged={changed}
            />
          )
        }
      />

      <Stack gap="xs">
        <SectionDivider label="Link" />
        {linkingByUrl ? (
          <LinkForm
            workItemId={objectId}
            reachable={reachable}
            onLinked={() => {
              setLinkingByUrl(false)
              changed()
            }}
          />
        ) : (
          <Group gap={4}>
            <Button variant="quiet" onClick={() => setLinkingByUrl(true)}>
              Link by URL
            </Button>
            {/*
              The examples are the whole of it: this fails on a URL that looks right but names the
              wrong kind of page, and the difference is not guessable. Shown on hover rather than
              spelled out under the button, because it only matters to someone who is unsure.
            */}
            <InfoDot
              label={
                <>
                  Paste a GitLab URL from your browser’s address bar:
                  <br />• a merge request — …/-/merge_requests/42
                  <br />• a branch — …/-/tree/my-branch
                  <br />• a commit — …/-/commit/a1b2c3d
                  <br />
                  <br />
                  Any project on gitlab.com works, not only the one in settings. An issue or a project
                  page is not something to link.
                </>
              }
            />
          </Group>
        )}
      </Stack>
    </Stack>
  )
}
