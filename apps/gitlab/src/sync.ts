import { slugify } from './branchName'

/**
 * Matching branches that already exist to work items that already exist.
 *
 * Installing this app into a workspace with history is the awkward moment: every work item already
 * has its branches and merge requests in GitLab, and none of them are here. Nothing about the app
 * makes that visible, so the panel says "no branch yet" about work that shipped weeks ago.
 *
 * The join has to be made from the branch name, because that is the only thing the two systems
 * already share. And it cannot assume this app's own naming — a workspace that has been working for
 * a year names branches after whatever tracker it used before, so a name is far more likely to read
 * `ABC-123-fix-the-thing` than anything this app would produce. The matcher therefore reads keys
 * *out of* names rather than expecting names it wrote.
 *
 * Everything here is pure. `sync.test.mjs` runs it.
 */

/**
 * The keys a branch name might be announcing, in the order they appear.
 *
 * A key is a word followed by a number, whole-token: `ABC-123`, `wi-1`. The pattern finds every one
 * of them, because a name carries other things that look the same — a trailing `-2` on a second
 * attempt at the same branch is a repeat marker, not a key — and the caller resolves the first that
 * is actually a work item. Order is what makes that safe: the real key is at the front, where people
 * put it.
 */
export function candidateKeys(branchName: string): string[] {
  const slug = slugify(branchName)
  const keys: string[] = []
  for (const match of slug.matchAll(/(?:^|-)([a-z]{2,})-(\d+)(?=-|$)/g)) {
    const key = `${match[1]}-${match[2]}`
    if (!keys.includes(key)) keys.push(key)
  }
  return keys
}

/** Work items, by the things a branch name could name them with. */
export type WorkItemIndex = {
  /** Normalised key value -> objectId. Built from whichever attribute holds the key. */
  byKey: Record<string, string>
  /** Normalised label -> objectId, for a branch named after the words rather than a key. */
  byLabel: Record<string, string>
}

/**
 * The work item a branch belongs to, or undefined.
 *
 * Keys first and in order, then the whole name against a label — which is how a branch this app
 * created for a work item with no key is found again.
 */
export function matchWorkItem(branchName: string, index: WorkItemIndex): string | undefined {
  for (const key of candidateKeys(branchName)) {
    const objectId = index.byKey[key]
    if (objectId) return objectId
  }
  return index.byLabel[slugify(branchName)]
}

/** One thing found in GitLab that could become a link. */
export type Candidate = {
  kind: 'branch' | 'merge-request'
  project: string
  /** Branch name, or merge request iid. */
  ref: string
  title: string
  url: string
  state: string
  author?: string
  /** For a merge request, the branch it comes from — what the match is made on. */
  matchOn: string
}

export type Plan = {
  /** Ready to create: a work item was identified and no link exists yet. */
  matched: (Candidate & { workItemId: string })[]
  /** Found in GitLab, no work item recognised in the name. Reported, never guessed at. */
  unmatched: Candidate[]
  /** Already linked. Counted so the run can say it did nothing rather than looking broken. */
  alreadyLinked: number
}

/**
 * What a sync would do, without doing any of it.
 *
 * Separated from the doing because this writes an object per match, and a bulk write nobody has seen
 * the shape of first is how a workspace ends up with three hundred links to the wrong things.
 */
export function planSync(
  candidates: Candidate[],
  index: WorkItemIndex,
  existing: Set<string>,
): Plan {
  const plan: Plan = { matched: [], unmatched: [], alreadyLinked: 0 }

  for (const candidate of candidates) {
    if (existing.has(`${candidate.kind}:${candidate.project}:${candidate.ref}`)) {
      plan.alreadyLinked += 1
      continue
    }
    const workItemId = matchWorkItem(candidate.matchOn, index)
    if (workItemId) plan.matched.push({ ...candidate, workItemId })
    else plan.unmatched.push(candidate)
  }

  return plan
}
