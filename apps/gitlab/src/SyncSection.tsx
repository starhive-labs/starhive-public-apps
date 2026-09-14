import { Alert, Group, ScrollArea, Stack, Text } from '@mantine/core'
import {
  displayOf,
  useAttributes,
  useBridge,
  useObjectQuery,
  useObjects,
  useStarhiveContext,
  useTypeById,
} from '@starhive/bridge'
import { Button, Card } from '@starhive/ui'
import { useMemo, useState } from 'react'

import { slugify } from './branchName'
import { ATTR, CODE_LINK_KEY, readLink, WORK_ITEM_KEY } from './codeLink'
import { gitlab } from './providers'
import { SectionDivider } from './SectionDivider'
import { type Candidate, type Plan, planSync, type WorkItemIndex } from './sync'

/**
 * Catching up with a workspace that already has history.
 *
 * The day this app is installed, every work item that has ever been worked on already has its
 * branches and merge requests in GitLab, and none of them are here — so the panel says "no branch
 * yet" about work that shipped weeks ago. This walks the configured projects, reads the key out of
 * each branch name, and links the ones it can identify.
 *
 * It previews before it writes. Every match becomes an object, and a bulk write nobody has seen the
 * shape of first is how a workspace ends up with three hundred links to the wrong things. What it
 * cannot identify is listed rather than guessed at.
 */
export function SyncSection({ projects, onChanged }: { projects: string[]; onChanged: () => void }) {
  const bridge = useBridge()
  const objects = useObjects()
  const columns = useAttributes(CODE_LINK_KEY, Object.values(ATTR))
  const { typeKeyToId, readTypeIds } = useStarhiveContext()

  // The type an admin actually pointed the app at, which is what has to be enumerated — not the app's
  // own `workItem`, which is only the default. The host allows reading it because the manifest's
  // `scopes.read` nominates it.
  //
  // The first of them: catching up walks one type, and a workspace that nominates several is a case
  // this section has not been taught yet — better one honest pass than a silent half of the work.
  const ownTypeId = typeKeyToId[WORK_ITEM_KEY]
  const workItemTypeId = readTypeIds?.[0] ?? ownTypeId
  const ownType = useTypeById(workItemTypeId)
  const workItems = useObjectQuery('order by Created desc', {
    // By id, because the configured type may be one an admin chose and this app never declared, so
    // it has no manifest key to name it by.
    typeId: workItemTypeId,
    limit: 500,
  })
  const existingLinks = useObjectQuery('order by Created desc', {
    typeKey: CODE_LINK_KEY,
    limit: 500,
  })

  const [plan, setPlan] = useState<Plan | null>(null)
  const [truncated, setTruncated] = useState(false)
  const [busy, setBusy] = useState<'preview' | 'apply' | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  /** Work items, indexed by whatever a branch name might call them. */
  const index = useMemo<WorkItemIndex>(() => {
    const byKey: Record<string, string> = {}
    const byLabel: Record<string, string> = {}
    const type = ownType.data
    if (!type) return { byKey, byLabel }

    const labelAttribute = type.attributes.find((attribute) => attribute.isLabel)
    // The key is whatever the type uses as one: a SEQUENCE if it has one — that is what a sequence
    // is for — and otherwise nothing, since guessing which TEXT attribute holds a key is how you
    // link a branch to the wrong work item.
    const keyAttribute = type.attributes.find(
      (attribute) => attribute.attributeTypeCode === 'SEQUENCE',
    )

    for (const object of workItems.data?.result ?? []) {
      const key = keyAttribute ? displayOf(object, keyAttribute.id) : undefined
      if (key) byKey[slugify(key)] = object.id
      const label = labelAttribute ? displayOf(object, labelAttribute.id) : undefined
      if (label) byLabel[slugify(label)] = object.id
    }
    return { byKey, byLabel }
  }, [ownType.data, workItems.data])

  const alreadyLinked = useMemo(() => {
    const byKey = new Map(columns.data.map((column) => [column.key ?? column.name, column.id]))
    const rows = (existingLinks.data?.result ?? []).map((object) =>
      readLink(object, (key) => byKey.get(key)),
    )
    return new Set(rows.map((row) => `${row.kind}:${row.project}:${row.ref}`))
  }, [existingLinks.data, columns.data])

  async function preview() {
    setBusy('preview')
    setMessage(null)
    setPlan(null)
    try {
      const candidates: Candidate[] = []
      let cutShort = false

      for (const project of projects) {
        const [branches, mergeRequests] = await Promise.all([
          gitlab.allBranches(bridge, project),
          gitlab.openMergeRequests(bridge, project),
        ])
        cutShort = cutShort || branches.truncated

        for (const branch of branches.branches) {
          candidates.push({ ...branch, kind: 'branch', matchOn: branch.ref })
        }
        for (const mr of mergeRequests) {
          // A merge request is matched on its source branch, not its title: the branch is what
          // carries the key, and a title is prose someone edited.
          candidates.push({ ...mr, kind: 'merge-request', matchOn: mr.sourceBranch })
        }
      }

      setTruncated(cutShort)
      setPlan(planSync(candidates, index, alreadyLinked))
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Could not read GitLab.')
    } finally {
      setBusy(null)
    }
  }

  async function apply() {
    if (!plan) return
    setBusy('apply')
    setMessage(null)
    const attributeIdOf = (key: string) =>
      columns.data.find((column) => (column.key ?? column.name) === key)?.id

    try {
      let created = 0
      for (const item of plan.matched) {
        const value = (key: string, text: string) => {
          const id = attributeIdOf(key)
          return id && text ? [{ attributeId: id, values: [text] }] : []
        }
        await objects.create(CODE_LINK_KEY, [
          ...value(ATTR.title, item.title),
          ...value(ATTR.workItem, item.workItemId),
          ...value(ATTR.project, item.project),
          ...value(ATTR.kind, item.kind),
          ...value(ATTR.ref, item.ref),
          ...value(ATTR.url, item.url),
          ...value(ATTR.state, item.state),
          ...value(ATTR.author, item.author ?? ''),
        ])
        created += 1
      }
      setPlan(null)
      setMessage(`Linked ${created} ${created === 1 ? 'thing' : 'things'}.`)
      onChanged()
    } catch (caught) {
      setMessage(
        `Stopped partway: ${caught instanceof Error ? caught.message : 'a link could not be saved'}. Run it again — what was already linked is skipped.`,
      )
    } finally {
      setBusy(null)
    }
  }

  if (projects.length === 0) return null

  const readable = Boolean(ownType.data) && !ownType.error
  const hasKeys = Object.keys(index.byKey).length > 0

  return (
    <Stack gap="xs">
      <SectionDivider label="Catch up with GitLab" />

      {!readable ? (
        <Text size="xs" c="dimmed">
          The work item type cannot be read, so there is no way to tell which work item a branch
          belongs to. That is normally a host too old to let an app read the type its own references
          point at.
        </Text>
      ) : (
        <>
          <Text size="xs" c="dimmed">
            Reads every branch and open merge request in {projects.length === 1 ? 'the project' : 'the projects'} above and links the ones whose
            name identifies a work item — a key like <code>ABC-123</code> at the front of the branch
            name
            {hasKeys ? '' : ', which needs a sequence attribute on the work item type'}. Nothing is
            written until you say so.
          </Text>

          <Group gap="xs">
            <Button variant="secondary" onClick={preview} disabled={busy !== null}>
              {busy === 'preview' ? 'Reading GitLab…' : 'Preview'}
            </Button>
            {plan && plan.matched.length > 0 && (
              <Button onClick={apply} disabled={busy !== null}>
                {busy === 'apply' ? 'Linking…' : `Link ${plan.matched.length}`}
              </Button>
            )}
          </Group>

          {message && (
            <Text size="xs" c="dimmed">
              {message}
            </Text>
          )}

          {truncated && (
            <Alert color="yellow" variant="light">
              One of these projects has more branches than a single run reads. Link what was found,
              then run it again.
            </Alert>
          )}

          {plan && (
            <Card>
              <Stack gap={4}>
                <Text size="sm">
                  {plan.matched.length} to link · {plan.unmatched.length} not recognised ·{' '}
                  {plan.alreadyLinked} already linked
                </Text>
                {/*
                  All of them, however many there are. This is the screen where somebody decides
                  whether to write a hundred objects into their workspace, and a preview that shows
                  eight of them and counts the rest is not a preview — the whole point of previewing
                  is that the list can be read before it is agreed to. `Autosize` so a run that
                  matched three branches does not get a tall empty box; the cap only bites once the
                  list is long enough to need scrolling.
                */}
                {plan.matched.length > 0 && (
                  <ScrollArea.Autosize mah={280} type="auto" offsetScrollbars>
                    <Stack gap={4}>
                      {plan.matched.map((item) => (
                        <Text
                          key={`${item.kind}:${item.project}:${item.ref}`}
                          size="xs"
                          c="dimmed"
                        >
                          {item.kind === 'merge-request' ? `!${item.ref}` : item.ref} —{' '}
                          {item.project}
                        </Text>
                      ))}
                    </Stack>
                  </ScrollArea.Autosize>
                )}
                {plan.matched.length === 0 && (
                  <Text size="xs" c="dimmed">
                    Nothing matched. Branch names have to carry a work item’s key for this to find
                    anything.
                  </Text>
                )}
              </Stack>
            </Card>
          )}
        </>
      )}
    </Stack>
  )
}
