/**
 * What this browser has already linked to a work item.
 *
 * The discovery pass decides what to create by asking what is already linked, and that question is
 * answered by a StarQL query — which reads the search index, which is written asynchronously. So for
 * a second or two after a write, the truthful answer to "is this already linked" is available
 * nowhere the app can reach: the object exists, and the only index that knows about it does not yet.
 * `useReloadAfterIndex` waits `INDEX_DELAY_MS` to cover that, but a delay is a guess, and the cost of
 * guessing low is a second link to the same merge request on somebody's work item.
 *
 * So the pass no longer relies on the guess alone. Everything created here is remembered, and the
 * next pass treats it as linked whether or not the index has caught up. Module scope on purpose: the
 * list remounts after every write (a new `key`), and this has to outlive exactly that.
 *
 * Not persisted, and it does not need to be. The window it covers is the seconds between a write and
 * its index entry; anything that tears the iframe down — closing the panel, reloading the page — has
 * taken far longer than that, and the query is authoritative again by the time it comes back.
 */
const linked = new Map<string, Set<string>>()

/**
 * What names a link within GitLab, for telling one from another.
 *
 * Project case is normalised and ref case is not, which is not an inconsistency: GitLab resolves a
 * project path regardless of case, so two rows differing only there are the same project — whereas
 * `ME/STAR-1` and `me/star-1` are two genuinely different branches, and collapsing them would hide
 * one behind the other.
 */
export function linkIdentity(link: { kind: string; project: string; ref: string }): string {
  return `${link.kind}:${link.project.toLowerCase()}:${link.ref}`
}

/** Record a link this browser just created, before any index knows about it. */
export function rememberLinked(workItemId: string, identity: string): void {
  const known = linked.get(workItemId) ?? new Set<string>()
  known.add(identity)
  linked.set(workItemId, known)
}

/**
 * Forget one, because somebody removed it.
 *
 * Without this, unlinking a row would leave it remembered as linked for the rest of the session, and
 * a pass that should have re-created it never would — the same staleness as the index lag, pointed
 * the other way.
 */
export function forgetLinked(workItemId: string, identity: string): void {
  linked.get(workItemId)?.delete(identity)
}

/** What was linked to this work item here, whatever the index currently says. */
export function linkedThisSession(workItemId: string): ReadonlySet<string> {
  return linked.get(workItemId) ?? new Set<string>()
}
