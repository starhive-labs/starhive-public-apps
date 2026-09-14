import { slugify } from './branchName'

/**
 * Finding a work item's code by the key the work item already has.
 *
 * The other direction from `sync.ts`. That one enumerates work items and reads keys *out of* branch
 * names, which is what an install-day catch-up needs and what a panel cannot afford — it also only
 * works on a type this app is allowed to enumerate. This one starts from one key and asks GitLab
 * who carries it, so the panel costs a search per project and works on whichever type an admin
 * pointed the setting at.
 *
 * It rests on the same convention every tracker before this one rested on: the key goes in the
 * branch name. That is not a fallback, it is the whole join — there is nothing else the two systems
 * already share.
 *
 * Everything here is pure, and imports only `slugify`. `discover.test.mjs` runs it.
 */

/**
 * Below this a term is not specific enough to search on, however well-formed it looks.
 *
 * Four characters of `a-z0-9` — `abc1` passes, `x-1` does not. A two-character project prefix is
 * possible but rare; a term that short would spend its search budget on whatever else in the
 * repository happens to contain those characters.
 */
const MIN_TERM_LENGTH = 4

/**
 * The term to search GitLab with for this work item, or undefined when there is nothing safe to ask.
 *
 * A SEQUENCE's prefix is optional — `SequenceConfiguration.sequencePrefix` defaults to empty — so a
 * perfectly ordinary type produces values like `42`. Searching a repository for `42` matches every
 * branch, merge request and commit message with those two digits anywhere in them, and the panel
 * would fill itself with other people's work. Nothing about the value says which kind it is, so the
 * shape has to decide: two letters and a digit, four characters, and only then is it specific enough
 * to be somebody's identifier rather than a number.
 *
 * The shape is judged on the slug — the form the match is actually made in — but the term that goes
 * out is what was stored, since that is what a branch named before this app existed would carry.
 */
export function searchTermFor(sequence: string | undefined): string | undefined {
  const term = (sequence ?? '').trim()
  const slug = slugify(term)
  if (slug.length < MIN_TERM_LENGTH) return undefined

  const letters = (slug.match(/[a-z]/g) ?? []).length
  const digits = (slug.match(/\d/g) ?? []).length
  if (letters < 2 || digits < 1) return undefined

  return term
}

/**
 * Whether [text] carries [key] as a key, rather than merely containing those characters.
 *
 * The reason this exists: GitLab's `search` is a substring match, so `STAR-1` comes back with
 * `STAR-12`, `STAR-123` and `STAR-1000` — and taken at face value, the lowest-numbered work item in
 * a project collects every branch its higher-numbered siblings ever had. The host searches; this
 * decides.
 *
 * Whole-token, on the same slug both sides, which is what makes `ME/STAR-2642`, `star-2642-fix` and
 * `feature/STAR-2642` all the same answer and `star-26420` a different one. Case is normalised here
 * too, so it does not matter whether the host matched case-sensitively.
 */
export function carriesKey(text: string, key: string): boolean {
  const needle = slugify(key)
  if (!needle) return false

  // Both sides are slugged to `a-z0-9-` before this, so there is nothing in the needle that means
  // anything to a regular expression — no escaping to get wrong.
  return new RegExp(`(?:^|-)${needle}(?=-|$)`).test(slugify(text))
}
