import { Stack, Text } from '@mantine/core'
import {
  useAttributes,
  useObjectQuery,
  useObjects,
  useStarhiveContext,
  useToast,
} from '@starhive/bridge'
import { Button } from '@starhive/ui'
import { useMemo, useState } from 'react'

import {
  ATTR,
  ATTR_NAME,
  branchNameFrom,
  CODE_LINK_KEY,
  defaultProject,
} from './codeLink'
import { CreateBranchModal } from './CreateBranchModal'
import type { CodeState } from './providers'
import type { WorkItem } from './useWorkItem'

/**
 * The offer to start a branch, shown when this work item has none.
 *
 * Once a branch exists the offer goes away: the branch is in the list above with its merge request
 * beside it, and a second branch for the same work item is the unusual case, not the one to put a
 * button in front of.
 */
export function BranchSection({
  workItemId,
  workItem,
  projects,
  branchNaming,
  branchCount,
  onChanged,
}: {
  workItemId: string
  /**
   * What the panel could read of the work item.
   *
   * Passed in rather than read here: the panel needs the same object for the key it searches GitLab
   * with, and the bridge's hooks hold no cache — two callers of `useWorkItem` would be two reads of
   * the object, its type and the same query, on every open.
   */
  workItem: WorkItem
  /** The configured naming template, still holding its tokens — resolved here, for this viewer. */
  branchNaming: string
  /** The projects an admin configured. A branch may be created in any of them. */
  projects: string[]
  /** How many branches this work item already has. Decides the offer, and names the next branch. */
  branchCount: number
  onChanged: () => void
}) {
  const objects = useObjects()
  const toast = useToast()
  const columns = useAttributes(CODE_LINK_KEY, Object.values(ATTR))
  const { user } = useStarhiveContext()
  const [open, setOpen] = useState(false)

  // What this work item is already using, which is the best guess at where its next branch goes.
  const existing = useObjectQuery(
    `"${ATTR_NAME.workItem}" = objectId("${workItemId}") order by Created desc`,
    { typeKey: CODE_LINK_KEY, limit: 50 },
  )
  const usedProjects = useMemo(() => {
    const id = columns.data.find((column) => (column.key ?? column.name) === ATTR.project)?.id
    if (!id) return []
    return (existing.data?.result ?? [])
      .map((object) => object.attributes.find((a) => a.attributeId === id)?.values[0]?.value ?? '')
      .filter(Boolean)
  }, [existing.data, columns.data])

  // A second branch for the same work item would otherwise be handed the name the first one already
  // has, and GitLab would refuse it — after the person had read it, accepted it and pressed the
  // button. Numbering it from the branches already here is the smallest honest default; the field is
  // editable, and someone naming a follow-up properly will say what it is.
  const suggestion = useMemo(
    () =>
      branchNameFrom({
        template: branchNaming,
        // Resolved per viewer, not per install: `{initials}` is the point of the token.
        person: user,
        key: workItem.sequence,
        label: workItem.label,
        attributes: workItem.attributes,
        objectId: workItemId,
        suffix: branchCount > 0 ? String(branchCount + 1) : undefined,
      }),
    [workItem.sequence, workItem.label, workItem.attributes, workItemId, branchCount, branchNaming, user],
  )

  const attributeIdOf = useMemo(() => {
    const byKey = new Map(columns.data.map((column) => [column.key ?? column.name, column.id]))
    return (key: string) => byKey.get(key)
  }, [columns.data])

  async function record(branch: string, project: string, created: CodeState) {
    const value = (key: string, text: string) => {
      const id = attributeIdOf(key)
      return id && text ? [{ attributeId: id, values: [text] }] : []
    }

    // A row exists only for a branch GitLab actually has, so it can say so plainly.
    const url = created.url

    await objects.create(CODE_LINK_KEY, [
      ...value(ATTR.title, branch),
      ...value(ATTR.workItem, workItemId),
      ...value(ATTR.project, project),
      ...value(ATTR.kind, 'branch'),
      ...value(ATTR.ref, branch),
      ...value(ATTR.url, url),
      ...value(ATTR.state, 'active'),
    ])

    toast('Branch created', 'success')
    onChanged()
  }

  const modal = (
    <CreateBranchModal
      opened={open}
      suggestion={suggestion}
      projects={projects}
      defaultProject={defaultProject(projects, usedProjects)}
      onClose={() => setOpen(false)}
      onCreated={record}
    />
  )

  if (projects.length === 0) {
    // Only worth saying where the offer would otherwise be. A work item that already has branches is
    // not the place to explain a setting.
    return branchCount > 0 ? null : (
      <Text size="sm" c="dimmed">
        No GitLab project is set. An admin lists them on the app’s settings page.
      </Text>
    )
  }

  // Quiet once there is one: the branch above is the answer to "what is happening here", and a second
  // branch is the exception rather than the next step.
  if (branchCount > 0) {
    return (
      <div>
        <Button variant="quiet" onClick={() => setOpen(true)} disabled={workItem.isLoading}>
          Create another branch
        </Button>
        {modal}
      </div>
    )
  }

  /*
   * An invitation, not a specification.
   *
   * This used to read out the branch name it was about to suggest, which put the longest string on
   * the panel in front of someone who had not yet decided to make a branch at all — and then said it
   * again in the dialog, where it is editable and therefore where it actually matters. What belongs
   * here is only that there is nothing yet and that starting is one click away.
   *
   * `workItem.problem` still has its line underneath, and it is the reason this one can be short: a
   * type with no SEQUENCE, an object with no key yet and a refused read all end in the same
   * `work-<id>` name and want completely different things done about them. That line says which, and
   * it appears only when there is something to say.
   */
  return (
    <Stack gap="xs">
      <Text fw={600}>No branch yet</Text>
      <Text size="sm" c="dimmed">
        {workItem.isLoading ? 'Reading this work item…' : 'Create one to get started.'}
      </Text>
      {workItem.problem && (
        <Text size="xs" c="dimmed">
          {workItem.problem}
        </Text>
      )}
      <div>
        <Button onClick={() => setOpen(true)} disabled={workItem.isLoading}>
          Create branch
        </Button>
      </div>
      {modal}
    </Stack>
  )
}
