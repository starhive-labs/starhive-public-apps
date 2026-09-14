import { Alert, Stack, Text, Textarea, Title } from '@mantine/core'
import {
  useBridge,
  useConfig,
  useAttribute,
  useObjectQuery,
  useStarhiveContext,
  useToast,
  useTypeById,
  useTypes,
} from '@starhive/bridge'
import { Badge, Button, Card, Select, TextInput } from '@starhive/ui'
import { useEffect, useMemo, useState } from 'react'

import {
  branchNameFrom,
  CODE_LINK_KEY,
  DEFAULT_BRANCH_TEMPLATE,
  readConfig,
  unknownTokens,
  WORK_ITEM_KEY,
} from '../codeLink'
import { gitlab } from '../providers'
import { useRemoteStatus } from '../useRemoteStatus'

/** Admin settings: which type a link may point at, and which GitLab project to search. */
export function SettingsPage() {
  const { typeKeyToId, user } = useStarhiveContext()
  const { config, isLoading, setConfig } = useConfig()
  const { data: types, isLoading: typesLoading } = useTypes()
  const reachable = useRemoteStatus('gitlab')
  const toast = useToast()

  // One existing link locks the work item type: changing it would orphan every reference already
  // written, and those references are the only thing tying code to a work item.
  const { data: links, isLoading: linksLoading } = useObjectQuery('order by Created desc', {
    typeKey: CODE_LINK_KEY,
    limit: 1,
  })

  const defaultWorkItemTypeId = typeKeyToId[WORK_ITEM_KEY] ?? ''
  const [workItemType, setWorkItemType] = useState('')
  const [projects, setProjects] = useState('')
  const [branchNaming, setBranchNaming] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /*
   * The chosen type's own attributes, which are what a naming template may name.
   *
   * Read here rather than described in help text: the tokens available depend on a type this app
   * does not own and an admin picked a moment ago, so the only honest list is the one fetched.
   */
  const target = useTypeById(workItemType || undefined)
  const attributeNames = useMemo(
    () => (target.data?.attributes ?? []).map((attribute) => attribute.name),
    [target.data],
  )
  const unknown = unknownTokens(branchNaming, attributeNames)

  const bridge = useBridge()
  const [checking, setChecking] = useState(false)
  const [check, setCheck] = useState<{ identity: string; projects: string[] } | null>(null)

  /**
   * Ask GitLab the two questions this app's failures actually turn on.
   *
   * A missing token and a mistyped project path produce the same 404 from the outside, so guessing
   * between them from a panel is hopeless. Asked separately, each answers for itself: `/user` says
   * who the host's calls arrive as, and the project lookup says whether that path exists for them.
   * Both are reads, so pressing this can do no harm.
   */
  async function runCheck() {
    setChecking(true)
    setCheck(null)
    try {
      const who = await gitlab.identity(bridge).catch(() => null)
      const identity = who
        ? `Calls go out as ${who.name}.`
        : 'No token is attached — calls go out anonymously, which is enough to read public projects and not enough to create a branch.'

      // Every project, not the first: one token may reach some of these and not others, and
      // finding that out one failed branch at a time is the situation this button exists to end.
      const checked = await Promise.all(
        listedProjects.map(async (path) => {
          try {
            const links = await gitlab.links(bridge, path)
            return `${path} — found, default branch ${links.defaultBranch}`
          } catch (caught) {
            return `${path} — ${caught instanceof Error ? caught.message : 'could not be read.'}`
          }
        }),
      )
      setCheck({ identity, projects: checked.length > 0 ? checked : ['No projects listed.'] })
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    if (isLoading) return
    const parsed = readConfig(config)
    setWorkItemType(parsed.workItemType ?? defaultWorkItemTypeId)
    setProjects(parsed.projects.join('\n'))
    setBranchNaming(parsed.branchNaming)
  }, [config, isLoading, defaultWorkItemTypeId])

  const locked = (links?.result.length ?? 0) > 0

  /*
   * What a link's reference actually points at, against what this page says it should.
   *
   * A config-bound reference target is re-pointed by the platform when the setting changes, and if
   * that does not happen the app looks fine and every write fails with a bare INVALID_VALUE - the
   * reference still demands the old type while the setting advertises the new one. The app can see
   * both, so it can say so instead of leaving someone to discover it one failed link at a time.
   */
  const linkReference = useAttribute(CODE_LINK_KEY, 'workItem')
  const boundTypeId = linkReference.data?.configuration?.targetTypeId
  const savedWorkItemType =
    typeof config?.workItemType === 'string' ? config.workItemType : undefined
  const mismatched = Boolean(
    boundTypeId && savedWorkItemType && boundTypeId !== savedWorkItemType,
  )
  const nameOfType = (id: string | undefined) =>
    (types ?? []).find((type) => type.id === id)?.name ?? id?.slice(0, 8) ?? 'unknown'
  /*
   * An attribute standing in for its own value, so a template naming one previews as something.
   *
   * The alternative is reading a real object of the type, which means picking one — and the preview
   * would then be about that object rather than about the template.
   */
  const exampleValues = useMemo(
    () => Object.fromEntries(attributeNames.map((name) => [name, name])),
    [attributeNames],
  )
  const listedProjects = projects
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const typeOptions = useMemo(() => {
    const list = (types ?? []).map((type) => ({
      value: type.id,
      label: `${type.name}${type.id === defaultWorkItemTypeId ? ' (default)' : ''}`,
    }))
    // Keep the current selection visible even if it isn't in the fetched list (e.g. another space).
    if (workItemType && !list.some((type) => type.value === workItemType)) {
      list.unshift({ value: workItemType, label: `Selected type (${workItemType.slice(0, 8)}…)` })
    }
    return list
  }, [types, workItemType, defaultWorkItemTypeId])

  async function save() {
    setSaving(true)
    setError(null)
    try {
      // Stored as a list; the old singular `project` is dropped on the first save, and readConfig
      // still understands it for an install that has not saved since.
      await setConfig({
        workItemType,
        projects: listedProjects,
        branchNaming: branchNaming.trim(),
        // Blanked, not left: `readConfig` upgrades an old prefix into a template only while there is
        // no template, so leaving it would resurrect the prefix the moment someone clears this field.
        branchPrefix: '',
      })
      toast('Settings saved', 'success')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading || linksLoading) {
    return (
      <Stack gap="md" p="lg">
        <Title order={3}>GitLab</Title>
        <Text size="sm" c="dimmed">
          Loading…
        </Text>
      </Stack>
    )
  }

  return (
    <Stack gap="md" p="lg">
      <Title order={3}>GitLab</Title>

      <Card>
        <Stack gap="sm">
          <Text fw={600}>GitLab</Text>
          <Text size="sm" c="dimmed">
            {reachable === null
              ? 'Checking…'
              : reachable
                ? 'Starhive can reach gitlab.com. Public projects work as they are; a private one needs a token, added under Settings → Apps → Connect. Starhive holds it and writes it onto each call — this app never sees it. Everyone who opens a Code panel sees what that one token can see, so a read-only token on a bot account is the safe choice.'
                : 'Starhive cannot reach gitlab.com from this workspace.'}
          </Text>
          {reachable !== null && (
            <div>
              <Badge variant={reachable ? 'success' : 'warning'}>
                {reachable ? 'Reachable' : 'Not reachable'}
              </Badge>
            </div>
          )}
          <div>
            <Button variant="secondary" onClick={runCheck} disabled={checking}>
              {checking ? 'Checking…' : 'Check GitLab'}
            </Button>
          </div>
          {check && (
            <Stack gap={4}>
              <Text size="sm">{check.identity}</Text>
              {check.projects.map((line) => (
                <Text key={line} size="sm">
                  {line}
                </Text>
              ))}
            </Stack>
          )}
        </Stack>
      </Card>

      {mismatched && (
        <Alert color="red" variant="light" title="Links still point at the old type">
          A link’s reference targets <b>{nameOfType(boundTypeId)}</b>, but this page is set to{' '}
          <b>{nameOfType(savedWorkItemType)}</b>. Until those agree, linking anything fails with
          INVALID_VALUE — the reference refuses an object of any other type. Saving this page again
          asks the platform to re-point it; if it stays out of step, the re-point is failing rather
          than not being asked for.
        </Alert>
      )}

      <Card>
        <Stack gap="sm">
          <Select
            label="Work item type"
            description={
              locked
                ? 'Locked: links already point at this type, and changing it would orphan them.'
                : 'The type a Code panel may link from. Point it at the type your team plans in.'
            }
            data={typeOptions}
            value={workItemType || null}
            onChange={(value) => setWorkItemType(value ?? '')}
            disabled={locked || typesLoading}
            searchable
          />
          <Textarea
            label="GitLab projects"
            description="One group/project per line. These are the projects a branch can be created in, and the ones the GitLab page summarises. Linking by URL works for any project, listed or not."
            placeholder={'group/project\ngroup/subgroup/project'}
            autosize
            minRows={3}
            maxRows={10}
            value={projects}
            onChange={(event) => setProjects(event.currentTarget.value)}
          />
          <TextInput
            label="Branch naming"
            description={`How a branch is named. Use {initials} for whoever creates the branch, {label} for the object's name, and any attribute of the type by its own name — listed below. A token written in lower case gives a lower-case value, one written in CAPITALS gives capitals. Anything outside braces is written as typed. Leave empty for ${DEFAULT_BRANCH_TEMPLATE}. {key} is also available, standing for whichever attribute is the type's sequence, if it has one.`}
            placeholder="{initials}/{key}-{label}"
            value={branchNaming}
            onChange={(event) => setBranchNaming(event.currentTarget.value)}
          />
          {/*
            Shown rather than described: `{initials}` resolves per person and `{key}` is only there
            on a type that has a SEQUENCE, so the only way to know what a template produces is to
            watch it produce one — as the admin reading it, on an example.
          */}
          <Text size="xs" c="dimmed">
            Yours would look like{' '}
            <code>
              {branchNameFrom({
                template: branchNaming,
                person: user,
                key: 'STAR-123',
                label: 'The name',
                attributes: exampleValues,
              })}
            </code>
            {' · '}
            on one with no sequence,{' '}
            <code>{branchNameFrom({ template: branchNaming, person: user, label: 'The name' })}</code>
            {attributeNames.length > 0 && ' — each attribute standing in for its own value'}
          </Text>
          {attributeNames.length > 0 && (
            <Text size="xs" c="dimmed">
              Attributes of {target.data?.name}, usable by name:{' '}
              {attributeNames.map((name) => `{${name}}`).join(' ')}
            </Text>
          )}
          {/*
            A token nobody implements renders as nothing, which looks like the field being ignored.
            Named rather than left to be discovered by a branch that came out short.
          */}
          {unknown.length > 0 && (
            <Text size="xs" c="red">
              {unknown.map((name) => `{${name}}`).join(', ')}{' '}
              {unknown.length > 1 ? 'resolve' : 'resolves'} to nothing —{' '}
              {target.data
                ? `neither a role nor an attribute of ${target.data.name}.`
                : 'no work item type is chosen yet, so only {initials}, {key} and {label} can be checked.'}
            </Text>
          )}

          {error && (
            <Text size="sm" c="red">
              {error}
            </Text>
          )}
          <Button onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </Stack>
      </Card>
    </Stack>
  )
}
