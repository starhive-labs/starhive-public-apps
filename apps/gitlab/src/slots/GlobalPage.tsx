import { Anchor, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core'
import {
  useAttributes,
  useBridge,
  useConfig,
  useObjectAggregate,
  useObjectQuery,
} from '@starhive/bridge'
import { Badge, Button, Card } from '@starhive/ui'
import { useEffect, useMemo, useState } from 'react'

import { invalidateAll } from '../cache'
import { ATTR, ATTR_NAME, CODE_LINK_KEY, daysSince, readConfig, readLink } from '../codeLink'
import { gitlab, type ProjectMergeRequest } from '../providers'
import { SectionDivider } from '../SectionDivider'
import { StatTile } from '../StatTile'
import { SyncSection } from '../SyncSection'
import { useRemoteStatus } from '../useRemoteStatus'

const age = (days: number | undefined) => (days === undefined ? '—' : `${days}d`)

/**
 * How many branches the page will ask GitLab about individually before it stops.
 *
 * One call each, and only for branches with no open merge request — normally a handful. The ceiling
 * is for the first install into a workspace with years of linked branches behind it, where drawing
 * one list should not cost a hundred requests.
 */
const MAX_PROPOSAL_CHECKS = 25

/** Three kinds, three plurals. Built rather than derived: English is not a rule. */
const KIND_PLURAL: Record<string, string> = {
  'merge-request': 'merge requests',
  branch: 'branches',
  commit: 'commits',
}

/**
 * What is happening in the project, and how much of it Starhive knows about.
 *
 * This page used to be a table of the app's link objects, which is what the space's own type view
 * already gives you for free — an app page that repeats the product is a page with nothing to say.
 *
 * What neither side can show alone is the *join*: GitLab knows its open merge requests, Starhive
 * knows which work item each belongs to, and the interesting rows are the ones where those two
 * disagree. A merge request nobody linked is untracked work; a branch with no merge request is work
 * that started and was never proposed. Both are invisible in either system on its own.
 *
 * Three reads, and they degrade separately. The project's queue is one live GitLab call, so it is
 * always current and it is the half that disappears when GitLab is unreachable. The counts are
 * aggregations over the app's own objects — no egress, correct past any page size, and still right
 * when the token is missing. The link rows are one query, and only the joins need them.
 */
export function GlobalPage() {
  const bridge = useBridge()
  const { config, isLoading: configLoading } = useConfig()
  const reachable = useRemoteStatus('gitlab')
  const { projects } = readConfig(config)

  const columns = useAttributes(CODE_LINK_KEY, Object.values(ATTR))
  const links = useObjectQuery('order by Created desc', { typeKey: CODE_LINK_KEY, limit: 200 })

  // Counted by the index rather than by tallying rows, so these stay right past the 200 above.
  const byKind = useObjectAggregate({ typeKey: CODE_LINK_KEY, operation: 'count', groupBy: 'kind' })
  const byState = useObjectAggregate({
    typeKey: CODE_LINK_KEY,
    where: `"${ATTR_NAME.kind}" = "merge-request"`,
    operation: 'count',
    groupBy: 'state',
  })

  const [queue, setQueue] = useState<ProjectMergeRequest[] | null>(null)
  const [queueError, setQueueError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  /**
   * The branches GitLab still has, per project it could be asked about.
   *
   * `null` until the first answer, and a project missing from the map is one that could not be
   * listed — which is not the same as a project with no branches, and must not be read as "every
   * branch you linked there is gone". Only projects present here take part in the existence check.
   */
  const [liveBranches, setLiveBranches] = useState<Map<string, Set<string>> | null>(null)
  /**
   * Linked branches that turned out to have had a merge request after all, keyed `project:branch`.
   *
   * Filled in by a second pass, because the first one cannot answer it: the review queue holds only
   * open merge requests, so a branch whose work merged has left it and would be reported as never
   * proposed — backwards, and worst for the work that got furthest. Reading every state per project
   * would answer it, and costs a crawl of the repository's whole history; asking about one branch
   * costs one call. So the question is asked only of the branches that would otherwise be listed,
   * which is a handful rather than a history.
   */
  const [everProposed, setEverProposed] = useState<Set<string>>(new Set())
  /** True when there were more candidates than [MAX_PROPOSAL_CHECKS] and some went unasked. */
  const [uncheckedBranches, setUncheckedBranches] = useState(false)

  /**
   * The open merge requests across every configured project.
   *
   * One call per project, in parallel, each cached by the host — so a workspace working in four
   * repositories costs four calls on the first load of the day and none on the next. A project that
   * cannot be read does not take the others with it: its failure is collected and named, because
   * "one of your four projects is misconfigured" is the useful version of that message.
   */
  const projectList = projects.join('\n')

  useEffect(() => {
    const wanted = projectList.split('\n').filter(Boolean)
    if (!reachable || wanted.length === 0) return
    let active = true
    setQueueError(null)

    void Promise.all(
      wanted.map(async (path) => {
        try {
          // Two questions about one project: the open review queue, and which branches GitLab still
          // has. The second is what stops a branch that was merged and deleted months ago from
          // sitting in "started, not proposed" forever.
          const [mergeRequests, branches] = await Promise.all([
            gitlab.openMergeRequests(bridge, path),
            gitlab.allBranches(bridge, path),
          ])
          return {
            path,
            found: mergeRequests,
            branches: new Set(branches.branches.map((branch) => branch.ref)),
          }
        } catch (caught) {
          return { path, error: caught instanceof Error ? caught.message : 'could not be read' }
        }
      }),
    ).then((results) => {
      if (!active) return
      setQueue(results.flatMap((result) => result.found ?? []))
      setLiveBranches(
        new Map(
          results
            .filter((result) => result.branches)
            .map((result) => [result.path, result.branches as Set<string>]),
        ),
      )
      const failed = results.filter((result) => result.error)
      setQueueError(
        failed.length === 0
          ? null
          : failed.map((result) => `${result.path}: ${result.error}`).join(' · '),
      )
    })

    return () => {
      active = false
    }
  }, [bridge, reachable, projectList, reloadToken])

  const stored = useMemo(() => {
    const byKey = new Map(columns.data.map((column) => [column.key ?? column.name, column.id]))
    const rows = (links.data?.result ?? []).map((object) =>
      readLink(object, (key) => byKey.get(key)),
    )
    return {
      mergeRequestRefs: new Set(
        rows.filter((row) => row.kind === 'merge-request').map((row) => `${row.project}:${row.ref}`),
      ),
      branches: rows.filter((row) => row.kind === 'branch'),
      workItemLinks: rows,
    }
  }, [links.data, columns.data])

  /**
   * The review queue: the open subset of what was read.
   *
   * Everything on this page that is about *waiting* — the count, the oldest, the untracked list —
   * asks this rather than the full read, which also holds every merge request that was ever merged
   * or closed.
   */
  const open = useMemo(() => (queue ?? []).filter((mr) => mr.state === 'opened'), [queue])

  /** Open in GitLab, linked to nothing here — untracked work, or a link nobody made. */
  const unlinked = open.filter((mr) => !stored.mergeRequestRefs.has(`${mr.project}:${mr.ref}`))

  /**
   * Branches that were proposed at some point, keyed by project **and** name.
   *
   * Any state, because the question is whether a merge request was ever opened from this branch, and
   * a merged one is the strongest possible yes. Asking only the open queue meant a branch dropped
   * back into "not proposed" the moment its work shipped.
   *
   * Keyed by project as well as name, which the old comparison was not: `main` or `fix-tests` exists
   * in every repository a workspace has, and matching on the name alone let a merge request in one
   * project answer for a branch in another.
   */
  const proposed = useMemo(
    () => new Set((queue ?? []).map((mr) => `${mr.project}:${mr.sourceBranch}`)),
    [queue],
  )

  /**
   * Linked branches GitLab still has that no open merge request comes from — the candidates.
   *
   * Not the answer yet: a branch whose merge request was merged or closed is in here too, and that
   * is the whole staleness complaint. [everProposed] removes those, once asked.
   *
   * The existence filter is deliberately conservative: a project that could not be listed is absent
   * from [liveBranches], and its branches are left in rather than declared gone on the strength of a
   * failed call. The page would rather show a row somebody has already dealt with than silently drop
   * work nobody has.
   */
  const candidates = useMemo(
    () =>
      stored.branches.filter((branch) => {
        const live = liveBranches?.get(branch.project)
        if (live && !live.has(branch.ref)) return false
        return !proposed.has(`${branch.project}:${branch.ref}`)
      }),
    [stored.branches, liveBranches, proposed],
  )

  /**
   * Ask GitLab, per candidate branch, whether anything was ever opened from it.
   *
   * One call each and only for branches that would otherwise be listed, so the usual cost is nil —
   * a workspace whose branches all have open merge requests asks nothing. Bounded anyway: a first
   * install with a hundred stale branches should not open a hundred requests to draw one list, and
   * the page says when it stopped short rather than quietly asserting a negative about the rest.
   */
  const candidateList = candidates.map((branch) => `${branch.project}:${branch.ref}`).join('|')

  useEffect(() => {
    const wanted = candidateList.split('|').filter(Boolean).slice(0, MAX_PROPOSAL_CHECKS)
    setUncheckedBranches(candidateList.split('|').filter(Boolean).length > MAX_PROPOSAL_CHECKS)
    if (!reachable || wanted.length === 0) return
    let active = true

    void Promise.all(
      wanted.map(async (key) => {
        const separator = key.indexOf(':')
        const path = key.slice(0, separator)
        const ref = key.slice(separator + 1)
        try {
          // `state=all` for one branch — the precise question, at the price of the vague one.
          return (await gitlab.mergeRequestsFor(bridge, path, ref)).length > 0 ? key : null
        } catch {
          // Unanswerable is not the same as "never proposed". Left out of the set, so the branch
          // stays listed rather than being hidden on the strength of a call that failed.
          return null
        }
      }),
    ).then((answers) => {
      if (!active) return
      setEverProposed(new Set(answers.filter((key): key is string => key !== null)))
    })

    return () => {
      active = false
    }
  }, [bridge, reachable, candidateList, reloadToken])

  /** The candidates that really were never proposed. */
  const unproposed = candidates.filter(
    (branch) => !everProposed.has(`${branch.project}:${branch.ref}`),
  )

  /**
   * The longest anything in the queue has been open.
   *
   * Each project's list arrives oldest-first, but several lists concatenated are not sorted, so this
   * is the maximum rather than the head — which is exactly the bug a single-project version would
   * never have shown. Over [open] and not the whole read, or the oldest merge request the repository
   * ever had would be reported as the thing keeping people waiting.
   */
  const oldestOpenDays = open.reduce<number | undefined>((oldest, mr) => {
    const days = daysSince(mr.createdAt)
    if (days === undefined) return oldest
    return oldest === undefined || days > oldest ? days : oldest
  }, undefined)

  const refresh = () => {
    invalidateAll()
    setQueue(null)
    setReloadToken((token) => token + 1)
    links.refetch()
    byKind.refetch()
    byState.refetch()
  }

  const loadingQueue = reachable !== false && projects.length > 0 && queue === null && !queueError

  if (configLoading) {
    return (
      <Stack gap="md" p="lg">
        <Title order={2}>GitLab</Title>
        <Text size="sm" c="dimmed">
          Loading…
        </Text>
      </Stack>
    )
  }

  return (
    <Stack gap="lg" p="lg">
      <Group justify="space-between" align="center">
        <Stack gap={0}>
          <Title order={2}>GitLab</Title>
          <Text size="sm" c="dimmed">
            {projects.length === 0
              ? 'No projects set — an admin lists them on the settings page.'
              : projects.join(' · ')}
          </Text>
        </Stack>
        <Button variant="quiet" size="compact-xs" onClick={refresh}>
          Refresh
        </Button>
      </Group>

      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
        <StatTile
          label="Open merge requests"
          value={queue ? open.length : queueError ? '—' : 0}
          hint="in GitLab now"
          loading={loadingQueue}
        />
        <StatTile
          label="Linked to a work item"
          value={open.length - unlinked.length}
          hint={queue ? `of ${open.length}` : undefined}
          loading={loadingQueue}
        />
        <StatTile label="Not linked" value={unlinked.length} loading={loadingQueue} />
        <StatTile
          label="Oldest open"
          value={age(oldestOpenDays)}
          loading={loadingQueue}
        />
      </SimpleGrid>

      {queueError && (
        <Text size="sm" c="dimmed">
          Some projects could not be read, so the figures above are short of them — {queueError}
        </Text>
      )}
      {reachable === false && (
        <Text size="sm" c="dimmed">
          GitLab cannot be reached from this workspace, so only what Starhive already knows is shown.
        </Text>
      )}

      {unlinked.length > 0 && (
        <Stack gap="xs">
          <SectionDivider label="Not linked to a work item" />
          <Text size="xs" c="dimmed">
            Open in GitLab with nothing here pointing at it. Link one from its work item’s GitLab
            panel.
          </Text>
          {unlinked.map((mr) => (
            <Card key={`${mr.project}:${mr.ref}`}>
              <Group justify="space-between" wrap="nowrap" gap="sm">
                <Text lineClamp={1}>
                  <Anchor href={mr.url} target="_blank" rel="noreferrer" inherit>
                    !{mr.ref} {mr.title}
                  </Anchor>
                </Text>
                <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                  {mr.project} · {mr.author ? `${mr.author} · ` : ''}
                  {age(daysSince(mr.createdAt))}
                </Text>
              </Group>
            </Card>
          ))}
        </Stack>
      )}

      {unproposed.length > 0 && (
        <Stack gap="xs">
          <SectionDivider label="Started, not proposed" />
          <Text size="xs" c="dimmed">
            Branches linked to a work item that still exist in GitLab and have never had a merge
            request opened from them — in any state.
          </Text>
          {uncheckedBranches && (
            <Text size="xs" c="dimmed">
              More than {MAX_PROPOSAL_CHECKS} branches had no open merge request, so only the first{' '}
              {MAX_PROPOSAL_CHECKS} were checked against GitLab for merged or closed ones — some rows
              below may already have been proposed.
            </Text>
          )}
          {unproposed.map((branch) => (
            <Card key={branch.objectId}>
              <Group justify="space-between" wrap="nowrap" gap="sm">
                <Text lineClamp={1}>
                  {branch.url ? (
                    <Anchor href={branch.url} target="_blank" rel="noreferrer" inherit>
                      {branch.title || branch.ref}
                    </Anchor>
                  ) : (
                    branch.title || branch.ref
                  )}
                </Text>
                <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                  {branch.project}
                </Text>
              </Group>
            </Card>
          ))}
        </Stack>
      )}

      <SyncSection projects={projects} onChanged={refresh} />

      <Stack gap="xs">
        <SectionDivider label="Tracked in Starhive" />
        <Group gap="xs">
          {Object.entries(byKind.data?.groups ?? {}).map(([kind, count]) => (
            <Badge key={kind}>
              {count} {KIND_PLURAL[kind] ?? kind}
            </Badge>
          ))}
          {byKind.data && <Badge>{byKind.data.total} links in total</Badge>}
        </Group>
        {byState.data?.groups && Object.keys(byState.data.groups).length > 0 && (
          <Text size="xs" c="dimmed">
            Merge request states, as last seen when someone opened them:{' '}
            {Object.entries(byState.data.groups)
              .map(([state, count]) => `${state} ${count}`)
              .join(' · ')}
          </Text>
        )}
      </Stack>
    </Stack>
  )
}
