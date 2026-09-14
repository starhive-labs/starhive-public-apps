import { Anchor, Group, Progress, Stack, Text } from '@mantine/core'
import { useAttributes, useBridge, useObjectQuery, useObjects } from '@starhive/bridge'
import { Badge, Button, Card } from '@starhive/ui'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'

import { ATTR, ATTR_NAME, CODE_LINK_KEY, readLink, stateVariant, type StoredLink } from './codeLink'
import { carriesKey } from './discover'
import { forgetLinked, linkedThisSession, linkIdentity, rememberLinked } from './linked'
import { type CodeLocator, type CodeState, gitlab } from './providers'
import { SectionDivider } from './SectionDivider'

/** What a live read came back with, per link object id. */
type Live = Record<string, { state: CodeState } | { error: string }>

/**
 * What names a link within GitLab, for comparing one against another.
 *
 * A ref alone does not: merge request numbers restart in every project, and branch names repeat
 * across them.
 */
const identityOf = (link: { project: string; ref: string }) => `${link.project}:${link.ref}`

const KIND_LABEL: Record<string, string> = {
  'merge-request': 'Merge request',
  branch: 'Branch',
  commit: 'Commit',
}

/**
 * The code linked to one work item, grouped the way the work goes: the branch, then what came of it.
 *
 * Two reads, deliberately layered. The links themselves are Starhive objects, so they come back from
 * one StarQL query and render with no network at all — which is what the panel shows when GitLab is
 * unreachable, and in the moment before the live read lands. Then each link is read from GitLab in
 * parallel and replaces its stored copy.
 *
 * A link whose live read fails keeps its stored line and says why underneath, because "this merge
 * request was open when we last looked" is worth more to someone reading a work item than an empty
 * panel is.
 */
export function LinkList({
  workItemId,
  reachable,
  projects,
  searchKey,
  keyProblem,
  onChanged,
  onLoaded,
  afterBranches,
}: {
  /** The object the panel is mounted on, and what a link's reference points at. */
  workItemId?: string
  /** Whether GitLab can be called at all. False means show stored state and say so. */
  reachable: boolean
  /** The configured `group/project` paths — where a search for this work item's key looks. */
  projects: string[]
  /**
   * This work item's own key, when it has one specific enough to search on.
   *
   * Undefined is the ordinary case for a type with no SEQUENCE, and also what a sequence with no
   * prefix produces — see `searchTermFor`. Nothing is searched then, and the panel still fills in
   * from branches that were linked some other way.
   */
  searchKey?: string
  /**
   * Why there is no key to search with, when there is none — `useWorkItem`'s own words.
   *
   * Carried down so the panel can say which of the several quite different things went wrong: a type
   * with no SEQUENCE, an object with no value yet, a read that was refused. They are one blank line
   * on screen and three different fixes.
   */
  keyProblem?: string
  onChanged?: () => void
  /**
   * What this list is holding, reported once it has loaded — the count, because the offer to make
   * another branch has to name it something the first one is not already called.
   *
   * The panel used to ask "is there a branch?" with a query of its own, and the two answers drifted:
   * a write is indexed asynchronously, so the panel's immediate refetch saw nothing while this list —
   * which waits out the index before remounting — saw the new branch. The result was a branch on
   * screen underneath an offer to create one. One question, asked once, in one place.
   */
  onLoaded?: (summary: { branchCount: number }) => void
  /**
   * Rendered where the branches end, before the merge requests begin.
   *
   * The offer to start another branch belongs with the branches, not stranded under everything else —
   * and only this component knows where that is. Passed in rather than built here so the list stays a
   * list: what to offer next is the panel's business.
   */
  afterBranches?: ReactNode
}) {
  const bridge = useBridge()
  const objects = useObjects()
  const columns = useAttributes(CODE_LINK_KEY, Object.values(ATTR))

  const where = workItemId ? `"${ATTR_NAME.workItem}" = objectId("${workItemId}")` : ''
  const starql = where ? `${where} order by Created desc` : 'order by Created desc'
  const { data, isLoading, error } = useObjectQuery(starql, {
    typeKey: CODE_LINK_KEY,
    limit: 50,
  })

  const attributeIdOf = useMemo(() => {
    const byKey = new Map(columns.data.map((column) => [column.key ?? column.name, column.id]))
    return (key: string) => byKey.get(key)
  }, [columns.data])

  /**
   * The stored links, with any row that names the same thing twice collapsed to one.
   *
   * Two rows for one merge request is a bug in whatever wrote them, but it is also a row somebody
   * has to look at, and — since a row the search keeps finding does not offer Unlink — one they may
   * have no way to remove. Collapsing here means an install that collected duplicates before the
   * write path was fixed heals on the next open, rather than needing the objects cleaned out by
   * hand. The extra objects stay in the app's space, harmless and invisible.
   *
   * First wins, which under `order by Created desc` is the newest: if the two disagree about what
   * GitLab last said, the later answer is the better one to keep.
   */
  const links = useMemo<StoredLink[]>(() => {
    const seen = new Set<string>()
    const unique: StoredLink[] = []
    for (const object of data?.result ?? []) {
      const link = readLink(object, attributeIdOf)
      const identity = linkIdentity(link)
      if (seen.has(identity)) continue
      seen.add(identity)
      unique.push(link)
    }
    return unique
  }, [data, attributeIdOf])

  const [live, setLive] = useState<Live>({})
  const [unlinkError, setUnlinkError] = useState<string | null>(null)
  /**
   * Where the key search has got to.
   *
   * A phase rather than a message, because two different things depend on it. It is what the panel
   * says it is doing — "searched and nothing carries this key" and "never searched" are the same
   * empty panel otherwise, and the difference is the whole diagnosis. And it is what decides whether
   * the offer to start a branch may be shown at all: "No branch yet" is a claim about GitLab, and
   * making it while still asking GitLab is how a panel tells someone to create a branch that already
   * exists. `settled` is the only phase that knows.
   */
  const [search, setSearch] = useState<
    | { phase: 'unknown' }
    | { phase: 'searching'; key: string; done: number; total: number }
    | { phase: 'settled'; message: string | null }
  >({ phase: 'unknown' })
  const report = useRef(onLoaded)
  report.current = onLoaded
  /**
   * What GitLab has from each branch, as of the last discovery pass.
   *
   * Keyed by project **and** ref, never ref alone: a merge request's number is per-project, so `!42`
   * exists in as many repositories as you like — and a link may name any project, not just the one on
   * the settings page. Keyed on the number alone, a merge request in one project attached itself to a
   * branch in another.
   *
   * The refs rather than a count, because this also answers "did this merge request row come from a
   * branch we track?" — which decides whether removing it could possibly stick.
   */
  const [discovered, setDiscovered] = useState<
    Record<string, { branchRef: string; mergeRequests: string[] }>
  >({})

  // Refetching on every render of a parent would re-ask GitLab for the same rows, so the effects
  // depend on the link identities rather than on the array.
  const identity = links.map((link) => `${link.objectId}:${link.kind}:${link.ref}`).join('|')

  useEffect(() => {
    if (isLoading || columns.isLoading) return
    report.current?.({ branchCount: links.filter((link) => link.kind === 'branch').length })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, columns.isLoading, identity])

  useEffect(() => {
    if (!reachable || links.length === 0) return
    let active = true

    void Promise.all(
      links.map(async (link) => {
        try {
          const state = await gitlab.read(bridge, {
            project: link.project,
            kind: link.kind as 'merge-request' | 'branch' | 'commit',
            ref: link.ref,
          })
          if (active) setLive((current) => ({ ...current, [link.objectId]: { state } }))
        } catch (caught) {
          const message = caught instanceof Error ? caught.message : 'Could not reach GitLab.'
          if (active) setLive((current) => ({ ...current, [link.objectId]: { error: message } }))
        }
      }),
    )

    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge, reachable, identity])

  /**
   * Fill the panel in from GitLab, with nobody linking anything.
   *
   * Two routes to the same place, deliberately run as one pass with one set of what is already known,
   * so a merge request both of them find is created once rather than twice.
   *
   * **By key** — everything in the configured projects carrying this work item's own key. This is the
   * convention every tracker before this one also ran on, and it is the only thing the two systems
   * already share: a branch cut as `STAR-2642-fix` belongs to STAR-2642 and says so. It finds work
   * nobody started from this panel, which is most of it.
   *
   * **By branch** — the merge requests opened *from* a branch already linked here. Not redundant: a
   * key search reads a merge request's title and description and never its source branch, so the
   * ordinary merge request — branch named after the key, title written in prose — is invisible to it
   * and found only this way.
   *
   * Runs on open rather than on a button, because the answer changes in GitLab and nobody thinks to
   * come back here and press refresh. Idempotent by construction: anything already linked is skipped,
   * so re-opening the panel writes nothing, and every call underneath goes through the cache.
   */
  useEffect(() => {
    if (!workItemId) return
    const branches = links.filter((link) => link.kind === 'branch' && link.ref && link.project)

    /*
     * Every reason this pass might do nothing, said before anything is awaited.
     *
     * The order matters, and so does the fact that there is no silent branch left. An unreachable
     * remote used to return here before any of this ran — no search, no message, no error — which is
     * indistinguishable from a work item that genuinely has no code behind it, and is exactly the
     * failure that is hardest to diagnose from outside the browser. Every exit now says which one it
     * took.
     */
    if (!reachable) {
      setSearch({
        phase: 'settled',
        message:
          `Not searching GitLab: this workspace cannot call GitLab at all. The app's "gitlab" remote ` +
          `is not available here — an admin connects it under Settings → Apps.`,
      })
      return
    }
    if (!searchKey) {
      setSearch({
        phase: 'settled',
        message:
          keyProblem ??
          'Not searching GitLab: this work item has no key to search for. Its type needs a SEQUENCE attribute.',
      })
    } else if (projects.length === 0) {
      setSearch({
        phase: 'settled',
        message: `Not searching GitLab for ${searchKey}: no projects are configured on the app's settings page.`,
      })
    } else {
      setSearch({ phase: 'searching', key: searchKey, done: 0, total: projects.length })
    }

    if (!searchKey && branches.length === 0) return

    // The query and this browser's own memory of what it wrote. The second half is what makes the
    // pass safe to re-run before search-manager has caught up — see `linked.ts`.
    const known = new Set([...links.map(linkIdentity), ...linkedThisSession(workItemId)])
    let active = true

    const createLink = async (item: CodeLocator & CodeState) => {
      const value = (attribute: string, text: string) => {
        const id = attributeIdOf(attribute)
        return id && text ? [{ attributeId: id, values: [text] }] : []
      }
      // Remembered before the await, not after: the next pass can begin while this one is still in
      // flight, and a link that exists only as an unresolved promise is exactly the one that gets
      // created twice.
      rememberLinked(workItemId, linkIdentity(item))
      await objects.create(CODE_LINK_KEY, [
        ...value(ATTR.title, item.title),
        ...value(ATTR.workItem, workItemId),
        ...value(ATTR.project, item.project),
        ...value(ATTR.kind, item.kind),
        ...value(ATTR.ref, item.ref),
        ...value(ATTR.url, item.url),
        ...value(ATTR.state, item.state),
        ...value(ATTR.author, item.author ?? ''),
      ])
    }

    void (async () => {
      let added = 0

      if (searchKey && projects.length > 0) {
        let hits = 0
        let rejected = 0
        let searched = 0
        const failures: string[] = []

        for (const project of projects) {
          try {
            const found = await gitlab.search(bridge, project, searchKey)
            searched += 1
            // Counted as each project answers rather than at the end, so a workspace with several
            // repositories sees the bar move instead of watching one long indeterminate wait.
            if (active) {
              setSearch({ phase: 'searching', key: searchKey, done: searched, total: projects.length })
            }
            for (const hit of found) {
              // The search was a substring match, which is how `STAR-1` comes back holding every
              // branch of `STAR-12` and `STAR-123`. This is where that is thrown out — before a
              // write, because a wrong link here is a row on somebody's work item, not a wrong list.
              if (!carriesKey(hit.matchedOn, searchKey)) {
                rejected += 1
                continue
              }
              hits += 1
              const key = linkIdentity(hit)
              if (!active || known.has(key)) continue
              known.add(key)
              await createLink(hit)
              added += 1
            }
          } catch (caught) {
            // One project that cannot be read does not stop the others, but it is no longer
            // swallowed: a panel that found nothing because every call 404'd looks exactly like one
            // where nothing carries the key, and those have completely different fixes.
            failures.push(
              `${project}: ${caught instanceof Error ? caught.message : 'could not be read'}`,
            )
          }
        }

        if (active) {
          const scope = `${searched} of ${projects.length} project${projects.length === 1 ? '' : 's'}`
          setSearch({
            phase: 'settled',
            message:
              hits === 0
                ? `Searched ${scope} for ${searchKey} — nothing carries it` +
                  (rejected > 0
                    ? `. ${rejected} near match${rejected === 1 ? '' : 'es'} rejected for not holding it as a whole key.`
                    : '.') +
                  (failures.length > 0 ? ` Could not read — ${failures.join('; ')}` : '')
                : `Searched ${scope} for ${searchKey} — ${hits} match${hits === 1 ? '' : 'es'}, ${added} newly linked.` +
                  (failures.length > 0 ? ` Could not read — ${failures.join('; ')}` : ''),
          })
        }
      }

      for (const branch of branches) {
        try {
          const found = await gitlab.mergeRequestsFor(bridge, branch.project, branch.ref)
          if (active) {
            setDiscovered((current) => ({
              ...current,
              [identityOf(branch)]: {
                branchRef: branch.ref,
                mergeRequests: found.map((item) => `${item.project}:${item.ref}`),
              },
            }))
          }
          for (const item of found) {
            const key = linkIdentity(item)
            if (known.has(key) || !active) continue
            known.add(key)
            await createLink(item)
            added += 1
          }
        } catch {
          // A project we cannot read is not worth a message here: the branch row already carries
          // GitLab's own explanation from its live read.
        }
      }

      if (added > 0 && active) onChanged?.()
    })()

    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge, reachable, workItemId, searchKey, projects.join('|'), identity])

  /**
   * Whether GitLab actually has this branch.
   *
   * A branch row exists from the moment someone takes its name away, which is before the branch does
   * — so "linked" and "exists" are different questions, and only the live read answers the second.
   * It decides whether a merge request can be offered at all: GitLab will not open one from a branch
   * that was never pushed, and offering it would be sending someone to a form that cannot be filled.
   */
  function existsInGitLab(link: StoredLink): boolean {
    const result = live[link.objectId]
    return Boolean(result && 'state' in result)
  }

  /** True when GitLab has a merge request from this branch — then the offer would be noise. */
  function hasMergeRequest(branch: StoredLink): boolean {
    return (discovered[identityOf(branch)]?.mergeRequests.length ?? 0) > 0
  }

  /**
   * The branch a merge request row was discovered from, if any.
   *
   * A row GitLab keeps telling us about cannot be removed on its own: discovery would add it back on
   * the next open, which is what made "Unlink" look broken. So such a row does not offer it, and says
   * where it comes from instead — the branch is the thing to unlink.
   */
  function discoveredFrom(link: StoredLink): string | undefined {
    if (link.kind !== 'merge-request') return undefined
    return Object.values(discovered).find((entry) =>
      entry.mergeRequests.includes(identityOf(link)),
    )?.branchRef
  }

  /**
   * Whether the next open would find this row again by its name.
   *
   * The same trap the discovered merge requests fell into, arriving from the other direction: a row
   * the key search keeps turning up cannot be removed on its own, because the next open puts it
   * straight back. So such a row does not offer Unlink, and says why — the way out is to rename the
   * branch, or to stop searching by changing the work item's key, neither of which belongs behind a
   * button in this panel.
   *
   * Asked of the data rather than remembered from the pass that wrote the row, so it is still the
   * right answer after a reload, and for rows linked long before this app searched for anything. A
   * branch's ref is its name — the exact text the search matched. A merge request's title is what
   * was searched too, though not all of it: a key living only in a description is invisible from
   * here, and such a row still offers an Unlink that will not stick. Narrow enough to leave rather
   * than to keep a copy of every description against.
   */
  function foundByKey(link: StoredLink): boolean {
    if (!searchKey) return false
    return carriesKey(link.kind === 'branch' ? link.ref : link.title, searchKey)
  }

  /**
   * Open GitLab's own "new merge request" screen, prefilled with this branch.
   *
   * Deliberately not a POST. Opening a merge request is a piece of writing — a title, a description,
   * reviewers, whether it should be a draft — and doing it silently from here would produce merge
   * requests nobody wrote. The app takes the person to the form with the branch already chosen and
   * gets out of the way; the merge request appears here on the next open, found by its source branch.
   */
  async function openNewMergeRequest(branch: StoredLink) {
    try {
      const { projectUrl } = await gitlab.links(bridge, branch.project)
      if (!projectUrl) return
      window.open(gitlab.newMergeRequestUrl(projectUrl, branch.ref), '_blank', 'noreferrer')
    } catch {
      // Nothing useful to add: the row's own live-read line already carries GitLab's answer.
    }
  }

  /**
   * Remove a link, and everything that only existed because of it.
   *
   * Unlinking a branch takes its discovered merge requests with it. Leaving them would strand rows
   * that offer no way to remove themselves — and they describe work on a branch this work item no
   * longer claims.
   *
   * No refetch here: the delete is indexed asynchronously, so asking again now returns the row we
   * just removed. `onChanged` waits the index out before the list remounts.
   */
  async function unlink(link: StoredLink) {
    setUnlinkError(null)
    try {
      const alsoRemove =
        link.kind === 'branch'
          ? links.filter(
              (other) =>
                other.kind === 'merge-request' &&
                (discovered[identityOf(link)]?.mergeRequests ?? []).includes(identityOf(other)),
            )
          : []

      for (const item of [link, ...alsoRemove]) {
        await bridge.objects.remove(item.objectId)
        // Dropped from this browser's memory too, or the next pass would treat a row somebody just
        // removed as still linked and decline to re-create it — the index lag, pointed the other way.
        if (workItemId) forgetLinked(workItemId, linkIdentity(item))
      }
      onChanged?.()
    } catch (caught) {
      setUnlinkError(caught instanceof Error ? caught.message : 'Could not unlink that.')
    }
  }

  function Row({ link }: { link: StoredLink }) {
    const result = live[link.objectId]
    const shown = result && 'state' in result ? result.state : null
    const title = shown?.title || link.title
    const state = shown?.state || link.state
    const url = shown?.url || link.url
    const author = shown?.author || link.author
    const detail = shown?.detail
    const isBranch = link.kind === 'branch'
    const hasCommits = state !== 'no commits yet'
    const offerMergeRequest =
      isBranch && existsInGitLab(link) && hasCommits && !hasMergeRequest(link)
    const fromBranch = discoveredFrom(link)
    const byKey = !fromBranch && foundByKey(link)
    const canUnlink = !fromBranch && !byKey

    return (
      <Card>
        <Stack gap={6}>
          {/*
            The whole width, with nothing beside it. A merge request's title is a sentence somebody
            wrote, and sharing the line with a badge left the badge fighting for the last few pixels
            of a long one — the status ended up the least legible thing in the row despite being the
            thing people scan for. It sits at the foot now, on a line of its own.
          */}
          <Text fw={600} lineClamp={2}>
            {url ? (
              <Anchor href={url} target="_blank" rel="noreferrer" inherit>
                {title}
              </Anchor>
            ) : (
              title
            )}
          </Text>

          <Text size="xs" c="dimmed">
            {KIND_LABEL[link.kind] ?? link.kind} · {link.project}
            {/* A branch's ref is its name, which the title above already is. */}
            {link.kind === 'merge-request' ? ` · !${link.ref}` : ''}
            {link.kind === 'commit' ? ` · ${link.ref}` : ''}
            {author ? ` · ${author}` : ''}
          </Text>

          {detail && (
            <Text size="xs" c="dimmed" lineClamp={1}>
              Tip: {detail}
            </Text>
          )}

          {isBranch && !existsInGitLab(link) && reachable && (
            <Text size="xs" c="dimmed">
              Not in GitLab yet — push it and this fills itself in.
            </Text>
          )}
          {isBranch && existsInGitLab(link) && !hasCommits && (
            <Text size="xs" c="dimmed">
              Nothing committed to it yet, so there is nothing to open a merge request from.
            </Text>
          )}
          {result && 'error' in result && !isBranch && (
            <Text size="xs" c="dimmed">
              Showing what we last saw — {result.error}
            </Text>
          )}
          {!reachable && (
            <Text size="xs" c="dimmed">
              Showing what we last saw — GitLab cannot be reached from this workspace.
            </Text>
          )}

          {fromBranch && (
            <Text size="xs" c="dimmed">
              Found from {fromBranch} — unlink that branch to remove this too.
            </Text>
          )}


          {/*
            A footer, so the row reads before it offers. What to do next sits on the left where the
            eye lands; Unlink is pushed to the far corner, because taking a link away is not one of
            a pair of choices — it is the way out, and it should not sit next to the way forward.
            An empty row would still take its Stack gap, so it is not rendered at all.
          */}
          {(state || offerMergeRequest || canUnlink) && (
            <Group gap="xs" mt={2} align="center">
              {state && <Badge variant={stateVariant(state)}>{state}</Badge>}
              {offerMergeRequest && (
                <Button variant="secondary" onClick={() => openNewMergeRequest(link)}>
                  Create merge request
                </Button>
              )}
              {canUnlink && (
                <Button variant="quiet" ml="auto" onClick={() => unlink(link)}>
                  Unlink
                </Button>
              )}
            </Group>
          )}
        </Stack>
      </Card>
    )
  }

  if (isLoading || columns.isLoading) {
    return (
      <Text size="sm" c="dimmed">
        Loading…
      </Text>
    )
  }

  if (error) {
    return (
      <Text size="sm" c="red">
        {error.message}
      </Text>
    )
  }

  // In the order the work happens, so the panel reads as a sequence rather than a pile.
  function LinkGroup({ heading, of }: { heading: string; of: StoredLink[] }) {
    if (of.length === 0) return null
    return (
      <Stack gap="xs">
        <SectionDivider label={heading} />
        {of.map((link) => (
          <Row key={link.objectId} link={link} />
        ))}
      </Stack>
    )
  }

  const branches = links.filter((link) => link.kind === 'branch')
  const mergeRequests = links.filter((link) => link.kind === 'merge-request')
  const commits = links.filter((link) => link.kind === 'commit')
  /**
   * Whether the offer to start a branch may be shown.
   *
   * "No branch yet" is a claim about GitLab, not about this list, so it has to wait for the search
   * that would disprove it — otherwise the panel spends its first second telling someone to create a
   * branch that already exists, and they do. A work item that already has a branch is exempt: that
   * offer says "create another", which is not a claim about absence and is true whenever it is shown.
   */
  const offerReady = branches.length > 0 || search.phase === 'settled'

  const hasBranchBlock = branches.length > 0 || (Boolean(afterBranches) && offerReady)

  return (
    <Stack gap="lg">
      {/*
        What the search is doing, first, because until it settles it is the only true thing on the
        panel — everything below is "what we knew before we asked".
      */}
      {search.phase === 'searching' && (
        <Stack gap={6}>
          <Text size="xs" c="dimmed">
            Searching GitLab for {search.key} — {search.done} of {search.total} project
            {search.total === 1 ? '' : 's'}…
          </Text>
          <Progress
            size="xs"
            radius="xl"
            // Indeterminate until the first project answers: a bar sitting at 0% looks stuck, where
            // an animated one reads as work in progress, which is what it is.
            value={search.done === 0 ? 100 : (search.done / search.total) * 100}
            animated={search.done === 0}
          />
        </Stack>
      )}

      {search.phase === 'settled' && search.message && (
        <Text size="xs" c="dimmed">
          {search.message}
        </Text>
      )}

      {unlinkError && (
        <Text size="sm" c="red">
          {unlinkError}
        </Text>
      )}

      {/*
        The branches and the offer to add one are a single block with nothing between them: the offer
        is the end of that list, not a section after it. The button's own padding is the spacing.
      */}
      {hasBranchBlock && (
        <Stack gap={0}>
          {/*
            No heading until there is a branch. An empty section announces a thing that is not there;
            the offer below says it better, and says what to do about it.
          */}
          <LinkGroup heading="Branches" of={branches} />
          {offerReady && afterBranches}
        </Stack>
      )}


      <LinkGroup heading="Merge requests" of={mergeRequests} />
      <LinkGroup heading="Commits" of={commits} />
    </Stack>
  )
}
