import type { StarhiveBridge } from '@starhive/bridge'

import { cached, invalidate } from '../cache'
import {
  type CodeLocator,
  type CodeState,
  type ProjectMergeRequest,
  type Provider,
  ProviderError,
  type SearchHit,
} from './types'

/**
 * How long an answer stays good.
 *
 * A branch or merge request changes when someone pushes, so minutes: long enough that opening the
 * same work item twice while reading it costs nothing, short enough that a panel is not lying about
 * work in progress. A project's address and default branch effectively never change, so hours — and
 * that is the answer fetched most often, since every merged-looking branch needs it.
 *
 * The same numbers are given to the host as `cacheSeconds`, which is where the sharing happens: this
 * app's own cache spares one viewer from asking twice, the host's spares everyone else from asking at
 * all. The host caps its own at an hour, so the twelve-hour project TTL is honoured here and trimmed
 * there — deliberately, since a stale answer in one browser costs less than one shared by a whole
 * workspace.
 *
 * Refresh on the panel clears this app's copy, and every write invalidates its own project on both
 * sides, so nothing here can strand someone with an answer they know is wrong.
 */
const STATE_TTL = 3 * 60 * 1000
const PROJECT_TTL = 12 * 60 * 60 * 1000

/** GitLab wants the project path as one path segment, so every slash in it is encoded. */
const project = (path: string) => encodeURIComponent(path.replace(/^\/+|\/+$/g, ''))

type GitLabMergeRequest = {
  iid?: number
  title?: string
  /**
   * Asked for only so a search hit can be checked against the same text GitLab matched on —
   * `in=title,description` — rather than against the title alone, which would throw away every
   * merge request whose key is in its description and nowhere else. Never shown.
   */
  description?: string
  state?: string
  web_url?: string
  author?: { name?: string; username?: string }
}

type GitLabOpenMergeRequest = GitLabMergeRequest & {
  source_branch?: string
  created_at?: string
}

type GitLabBranch = {
  name?: string
  merged?: boolean
  web_url?: string
  commit?: { title?: string; author_name?: string }
}

type GitLabProject = {
  web_url?: string
  default_branch?: string
}

type GitLabCompare = {
  commits?: unknown[]
}

type GitLabCommit = {
  id?: string
  short_id?: string
  title?: string
  web_url?: string
  author_name?: string
}

/**
 * Ask GitLab, through the host.
 *
 * The app never holds the token and never knows the address: it names the remote its manifest
 * declared and a path within it, and Starhive writes the credential on the way out. A non-2xx comes
 * back as a value with that status — it is GitLab's answer, so it is turned into a `ProviderError`
 * carrying the status rather than being swallowed.
 */
function message(status: number): string {
  // 401/403 and 404 are the same situation seen from two angles: GitLab hides a private project
  // behind a 404 for an anonymous caller. Both mean "add a token", which is the only thing the
  // reader can act on, so both say it.
  if (status === 401 || status === 403) {
    return 'GitLab refused the request. A private project needs a token — an admin adds one under Settings → Apps.'
  }
  if (status === 404) {
    return (
      'Not found in GitLab. Check the project path on the settings page first — a path that does ' +
      'not exist gives the same answer as one you have no access to.'
    )
  }
  return `GitLab answered ${status}.`
}

async function get<T>(bridge: StarhiveBridge, path: string, ttlMs = STATE_TTL): Promise<T> {
  return cached(path, ttlMs, async () => {
    const response = await bridge.fetch('gitlab', path, {
      cacheSeconds: Math.round(ttlMs / 1000),
    })
    if (!response.ok) {
      throw new ProviderError(message(response.status), response.status)
    }
    return response.json<T>()
  })
}

const mergeRequestState = (mr: GitLabMergeRequest) => (mr.state ?? 'opened').toLowerCase()

/**
 * What a branch's state is, in the sense a person means it.
 *
 * GitLab's `merged` says the branch's tip is already contained in the default branch. For a branch
 * cut from `main` and not yet committed to, that is trivially true — so a branch created a minute ago
 * reported itself as `merged`, which reads as "this work is done" and is the opposite of the truth.
 * It stays true, too, if `main` moves on while the branch sits untouched.
 *
 * So `merged` alone is not the question. The question is whether the branch carries any commit the
 * default branch does not, which `compare` answers exactly. Only asked when GitLab claims merged, so
 * a branch someone is working on still costs one call.
 */
async function branchState(
  bridge: StarhiveBridge,
  projectPath: string,
  ref: string,
  merged: boolean,
): Promise<string> {
  if (!merged) return 'active'
  try {
    const { defaultBranch } = await gitlab.links(bridge, projectPath)
    if (defaultBranch === ref) return 'active'
    const compare = await get<GitLabCompare>(
      bridge,
      `/api/v4/projects/${project(projectPath)}/repository/compare` +
        `?from=${encodeURIComponent(defaultBranch)}&to=${encodeURIComponent(ref)}`,
    )
    return (compare.commits?.length ?? 0) > 0 ? 'merged' : 'no commits yet'
  } catch {
    // The comparison is the refinement, not the fact. If it cannot be made, say the less specific
    // thing rather than the wrong one.
    return 'active'
  }
}

export const gitlab: Provider = {
  key: 'gitlab',
  name: 'GitLab',
  remote: 'gitlab',

  /**
   * Read a GitLab URL.
   *
   * Every URL that names something inside a project has the same shape: the project path, then the
   * literal `/-/`, then what it is. Splitting on `/-/` is what makes a nested group work — the
   * project path can be any number of segments, so counting them cannot tell you where it ends.
   */
  locate(url) {
    let parsed: URL
    try {
      parsed = new URL(url.trim())
    } catch {
      return null
    }
    const [projectPath, rest] = parsed.pathname.split('/-/')
    if (!projectPath || !rest) return null

    const path = projectPath.replace(/^\/+|\/+$/g, '')
    const [what, ...tail] = rest.split('/')
    const ref = tail.join('/')
    if (!path || !ref) return null

    switch (what) {
      case 'merge_requests':
        // `/-/merge_requests/42/diffs` is still merge request 42.
        return { project: path, kind: 'merge-request', ref: ref.split('/')[0] }
      case 'tree':
      case 'branches':
        return { project: path, kind: 'branch', ref: decodeURIComponent(ref) }
      case 'commit':
        return { project: path, kind: 'commit', ref: ref.split('/')[0] }
      default:
        return null
    }
  },

  async read(bridge, locator) {
    const base = `/api/v4/projects/${project(locator.project)}`

    if (locator.kind === 'merge-request') {
      const mr = await get<GitLabMergeRequest>(bridge, `${base}/merge_requests/${locator.ref}`)
      return {
        title: mr.title ?? `!${locator.ref}`,
        url: mr.web_url ?? '',
        state: mergeRequestState(mr),
        author: mr.author?.name ?? mr.author?.username,
      }
    }

    if (locator.kind === 'branch') {
      const branch = await get<GitLabBranch>(
        bridge,
        `${base}/repository/branches/${encodeURIComponent(locator.ref)}`,
      )
      return {
        title: branch.name ?? locator.ref,
        url: branch.web_url ?? '',
        state: await branchState(bridge, locator.project, locator.ref, branch.merged === true),
        detail: branch.commit?.title,
      }
    }

    const commit = await get<GitLabCommit>(bridge, `${base}/repository/commits/${locator.ref}`)
    return {
      title: commit.title ?? commit.short_id ?? locator.ref,
      url: commit.web_url ?? '',
      state: 'committed',
      author: commit.author_name,
    }
  },

  /**
   * Merge requests and branches carrying a work item's key.
   *
   * Two calls rather than one: GitLab searches merge requests and branches through different
   * endpoints, and a developer who copied a branch name may not have opened a merge request yet — so
   * a branch alone has to be findable, or the feature only works after the fact.
   *
   * Both are substring matches, and neither is the answer on its own — each hit carries the text it
   * was found by, and the caller decides. The merge request call is the loose one: it reads title
   * and description, never the source branch, so a branch named `STAR-123-fix` with a merge request
   * titled "Fix the thing" does not turn up here at all. That one is found the other way, by
   * [mergeRequestsFor] once its branch is linked — which is why both routes exist.
   */
  async search(bridge, projectPath, term) {
    const base = `/api/v4/projects/${project(projectPath)}`
    const key = encodeURIComponent(term)

    const [mergeRequests, branches] = await Promise.all([
      get<GitLabMergeRequest[]>(
        bridge,
        `${base}/merge_requests?scope=all&state=all&search=${key}&in=title,description&per_page=20`,
      ).catch(() => [] as GitLabMergeRequest[]),
      get<GitLabBranch[]>(bridge, `${base}/repository/branches?search=${key}&per_page=20`).catch(
        () => [] as GitLabBranch[],
      ),
    ])

    const found: SearchHit[] = []

    for (const mr of mergeRequests) {
      if (mr.iid === undefined) continue
      found.push({
        project: projectPath,
        kind: 'merge-request',
        ref: String(mr.iid),
        title: mr.title ?? `!${mr.iid}`,
        url: mr.web_url ?? '',
        state: mergeRequestState(mr),
        author: mr.author?.name ?? mr.author?.username,
        // The two fields `in=title,description` named, so the check is made against what was searched.
        matchedOn: `${mr.title ?? ''} ${mr.description ?? ''}`,
      })
    }

    for (const branch of branches) {
      if (!branch.name) continue
      found.push({
        project: projectPath,
        kind: 'branch',
        ref: branch.name,
        title: branch.name,
        url: branch.web_url ?? '',
        // Not refined here: a search may return many branches, and one comparison each would turn a
        // list into a burst of calls. The panel refines each branch on its own read.
        state: branch.merged ? 'merged' : 'active',
        detail: branch.commit?.title,
        matchedOn: branch.name,
      })
    }

    return found
  },

  async mergeRequestsFor(bridge, projectPath, branch) {
    const found = await get<GitLabMergeRequest[]>(
      bridge,
      `/api/v4/projects/${project(projectPath)}/merge_requests` +
        `?source_branch=${encodeURIComponent(branch)}&state=all&per_page=20`,
    )
    return found
      .filter((mr) => mr.iid !== undefined)
      .map((mr) => ({
        project: projectPath,
        kind: 'merge-request' as const,
        ref: String(mr.iid),
        title: mr.title ?? `!${mr.iid}`,
        url: mr.web_url ?? '',
        state: mergeRequestState(mr),
        author: mr.author?.name ?? mr.author?.username,
      }))
  },

  /**
   * Branch off the default branch.
   *
   * The only write this app makes to GitLab, and the only call that needs more than read access — so
   * a workspace that connected a read-only token gets a 403 here and nowhere else. That is why the
   * modal offers copying the name as an equal option rather than a fallback: on a read-only token,
   * copying is the whole feature.
   */
  async createBranch(bridge, projectPath, branch) {
    const { defaultBranch, projectUrl } = await this.links(bridge, projectPath)
    const response = await bridge.fetch(
      'gitlab',
      `/api/v4/projects/${project(projectPath)}/repository/branches` +
        `?branch=${encodeURIComponent(branch)}&ref=${encodeURIComponent(defaultBranch)}`,
      { method: 'POST' },
    )
    if (!response.ok) {
      // GitLab says 400 for "already exists" as well as for a bad name, and the difference matters
      // to someone who just clicked the button.
      const body = response.body ?? ''
      throw new ProviderError(
        body.includes('already exists')
          ? `Branch ${branch} already exists in GitLab.`
          : response.status === 400
            ? `GitLab would not create that branch: ${body.slice(0, 200)}`
            : message(response.status),
        response.status,
      )
    }
    // The project now has a branch it did not have a moment ago, so nothing cached about it can be
    // trusted — including the branch listing this app searches.
    invalidate(`/api/v4/projects/${project(projectPath)}`)
    const created = response.json<GitLabBranch>()
    return {
      title: branch,
      url: created.web_url ?? `${projectUrl}/-/tree/${encodeURIComponent(branch)}`,
      // It was cut from the default branch a moment ago, so it carries nothing of its own yet.
      state: 'no commits yet',
      detail: created.commit?.title,
    }
  },

  async links(bridge, projectPath) {
    const details = await get<GitLabProject>(
      bridge,
      `/api/v4/projects/${project(projectPath)}`,
      PROJECT_TTL,
    )
    return {
      projectUrl: (details.web_url ?? '').replace(/\/+$/, ''),
      defaultBranch: details.default_branch ?? 'main',
    }
  },

  async allBranches(bridge, projectPath) {
    const perPage = 100
    const maxPages = 5
    const branches: (CodeLocator & CodeState)[] = []
    let truncated = false

    for (let page = 1; page <= maxPages; page += 1) {
      const found = await get<GitLabBranch[]>(
        bridge,
        `/api/v4/projects/${project(projectPath)}/repository/branches` +
          `?per_page=${perPage}&page=${page}`,
      )
      for (const branch of found) {
        if (!branch.name) continue
        branches.push({
          project: projectPath,
          kind: 'branch',
          ref: branch.name,
          title: branch.name,
          url: branch.web_url ?? '',
          // Not refined with a compare here: a repository with hundreds of branches would be
          // hundreds of extra calls to say "active" about branches nobody has linked yet. The panel
          // refines each one on its own read, once it matters.
          state: branch.merged ? 'merged' : 'active',
          detail: branch.commit?.title,
        })
      }
      if (found.length < perPage) return { branches, truncated: false }
      truncated = page === maxPages
    }

    return { branches, truncated }
  },

  async openMergeRequests(bridge, projectPath) {
    const found = await get<GitLabOpenMergeRequest[]>(
      bridge,
      `/api/v4/projects/${project(projectPath)}/merge_requests` +
        '?state=opened&per_page=100&order_by=created_at&sort=asc',
    )
    const queue: ProjectMergeRequest[] = []
    for (const mr of found) {
      // A merge request with no source branch is not one this app can reason about, and GitLab has
      // no reason to omit it — so it is a shape we do not understand rather than a case to guess at.
      if (mr.iid === undefined || !mr.source_branch) continue
      queue.push({
        project: projectPath,
        kind: 'merge-request',
        ref: String(mr.iid),
        title: mr.title ?? `!${mr.iid}`,
        url: mr.web_url ?? '',
        state: mergeRequestState(mr),
        author: mr.author?.name ?? mr.author?.username,
        sourceBranch: mr.source_branch,
        createdAt: mr.created_at,
      })
    }
    return queue
  },

  async identity(bridge) {
    const response = await bridge.fetch('gitlab', '/api/v4/user')
    if (!response.ok) return null
    const user = response.json<{ username?: string; name?: string }>()
    return { name: user.name ?? user.username ?? 'someone' }
  },

  newMergeRequestUrl(projectUrl, branch) {
    const source = encodeURIComponent(branch)
    return `${projectUrl}/-/merge_requests/new?merge_request%5Bsource_branch%5D=${source}`
  },
}
