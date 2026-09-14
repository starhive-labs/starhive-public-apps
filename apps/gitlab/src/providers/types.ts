import type { StarhiveBridge } from '@starhive/bridge'

/** The three things a work item can point at. */
export type CodeRefKind = 'merge-request' | 'branch' | 'commit'

/** Where something lives, once a URL has been read. Enough to ask the provider about it again. */
export type CodeLocator = {
  project: string
  kind: CodeRefKind
  /** The iid, branch name or sha — whatever identifies it inside the project. */
  ref: string
}

/** What a provider answers with. The same shape whichever host it came from. */
export type CodeState = {
  /**
   * What this thing is called. For a branch that is its name and nothing else — a branch's tip
   * commit belongs to whatever it was cut from, so showing that message here made a new branch
   * announce someone else's commit as its own name.
   */
  title: string
  url: string
  /** The provider's own word, lowercased: `opened`, `merged`, `closed`, `active`… */
  state: string
  /**
   * Who this is by, where that means something. A merge request has an author and a commit has one;
   * a branch does not — GitLab can only say who wrote the commit it currently points at, which for a
   * new branch is the person whose commit it was cut from. Left unset rather than guessed.
   */
  author?: string
  /** A second line of context, when there is one worth showing. For a branch, its tip commit. */
  detail?: string
}

/**
 * Something a search turned up, and the text that made it a hit.
 *
 * `matchedOn` is there because the two ends ask different questions. A host searches for a
 * substring; the caller wants to know whether a key is in there *as a key*, and `STAR-1` is a
 * substring of `STAR-12`. So the provider says where it looked — a branch's name, a merge request's
 * title and description — and `carriesKey` in `discover.ts` decides whether that is really this
 * work item. Keeping the decision out here also keeps it one rule rather than one per provider.
 */
export type SearchHit = CodeLocator & CodeState & { matchedOn: string }

/**
 * A merge request as the project lists it, rather than as a work item links it.
 *
 * Carries `sourceBranch`, which is the only thing that ties one back to a branch this app knows
 * about — and so the only way to tell a merge request that belongs to tracked work from one nobody
 * has linked.
 */
export type ProjectMergeRequest = CodeLocator &
  CodeState & {
    sourceBranch: string
    /** ISO 8601, as the provider gave it. */
    createdAt?: string
  }

/**
 * One code host.
 *
 * The seam exists on day one though only GitLab is behind it, because the shape of the app — what a
 * link stores, what the panel draws, what a branch name carries — is decided by this interface, and
 * a second provider added later should be a file, not a refactor. Everything above this line works
 * in `CodeLocator` and `CodeState`; nothing else knows what a merge request is called.
 */
export type Provider = {
  /** Stored on every link, so a workspace that later connects a second host can tell them apart. */
  key: string
  name: string
  /** The manifest remote this provider calls. */
  remote: string
  /** Recognise one of this provider's URLs. Null for anything it does not own. */
  locate(url: string): CodeLocator | null
  /** Read one thing's state now. Rejects if the call could not be made. */
  read(bridge: StarhiveBridge, locator: CodeLocator): Promise<CodeState>
  /**
   * Everything in `project` that the host thinks carries `term` — the merge requests and branches
   * behind a work item. This is what makes a link appear without anyone pasting a URL.
   *
   * Deliberately generous: it is a substring search, and every hit carries the text it matched on so
   * the caller can hold it to a stricter rule. A provider that narrowed it here would be deciding
   * what counts as a key, which is not a thing that differs between hosts.
   */
  search(bridge: StarhiveBridge, project: string, term: string): Promise<SearchHit[]>

  /**
   * The merge requests opened *from* a branch, in any state.
   *
   * Separate from [search] because it asks a precise question — this exact source branch — where
   * search asks a fuzzy one. It is what turns "a branch was created here" into "and here is the
   * merge request for it", with nobody linking anything.
   */
  mergeRequestsFor(
    bridge: StarhiveBridge,
    project: string,
    branch: string,
  ): Promise<(CodeLocator & CodeState)[]>

  /** Create a branch off the project's default branch. Needs a token with write access. */
  createBranch(bridge: StarhiveBridge, project: string, branch: string): Promise<CodeState>

  /**
   * Where a person goes to open a merge request for a branch, and where the project lives.
   *
   * The app never knows the host's address — that is the proxy's whole point — so the project's own
   * `web_url` is asked for and everything a human clicks is built from it.
   */
  links(
    bridge: StarhiveBridge,
    project: string,
  ): Promise<{ projectUrl: string; defaultBranch: string }>

  /** The URL that opens this provider's "new merge request" screen for a branch, prefilled. */
  newMergeRequestUrl(projectUrl: string, branch: string): string

  /**
   * Every branch in the project.
   *
   * Paged through to a bounded ceiling, because a long-lived repository has hundreds and the caller
   * is a one-off initialisation, not a panel. What comes back says whether it was cut short.
   */
  allBranches(
    bridge: StarhiveBridge,
    project: string,
  ): Promise<{ branches: (CodeLocator & CodeState)[]; truncated: boolean }>

  /**
   * Every open merge request in the project, oldest first.
   *
   * One call, and deliberately only the open ones. Reading every state to find out whether a branch
   * was ever proposed sounds like the same request with a wider filter, but it is a crawl of the
   * repository's whole history — five paged calls against a repository with a thousand merge
   * requests, where this is one. [mergeRequestsFor] answers that question about a single branch for
   * the price of a single call, and the branches worth asking about are a handful.
   */
  openMergeRequests(bridge: StarhiveBridge, project: string): Promise<ProjectMergeRequest[]>

  /**
   * Who the host's calls arrive as, or null when they arrive as nobody.
   *
   * The app cannot see whether a credential is stored — `bridge.remotes()` tells it only that a call
   * can be made. Asking the far end who it thinks we are is the only way to find out, and it is the
   * difference between "your token is missing" and "your path is wrong", which are the same 404 from
   * the outside.
   */
  identity(bridge: StarhiveBridge): Promise<{ name: string } | null>
}

/** A call the far end answered with something other than 2xx — an answer, not a failure of ours. */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ProviderError'
  }
}
