/**
 * Stand-in avatars.
 *
 * Starhive does not hand an app a picture of anybody: `StarhiveUser` is an id, a name and an email,
 * and there is no user directory to read either. So an avatar here is initials on a coloured disc,
 * and the colour is derived from the person's id so that the same person is the same colour every
 * time they appear — which is most of what an avatar is actually for.
 */

/** `Mathias Edblom` → `ME`, `ada@starhive.com` → `A`. Two letters at most. */
export function initialsOf(name: string | undefined, email?: string): string {
  const source = (name ?? '').trim()
  if (source) {
    const words = source.split(/\s+/).filter(Boolean)
    const letters = words.length > 1 ? `${words[0][0]}${words[words.length - 1][0]}` : words[0].slice(0, 2)
    return letters.toUpperCase()
  }
  const local = (email ?? '').trim().split('@')[0]
  return local ? local.slice(0, 1).toUpperCase() : '?'
}

/**
 * A stable hue for a person, 0–359.
 *
 * FNV-1a with a final avalanche, rather than the obvious `hash * 31 + c`. The obvious one is stable,
 * which is the only property that seemed to matter — but it maps neighbouring strings to
 * neighbouring numbers, so a row of ids that differ in their last character comes out as a row of
 * near-identical colours. Avatars in a workspace are exactly that case.
 */
export function avatarHue(seed: string | undefined): number {
  if (!seed) return 210
  let hash = 2166136261
  for (let index = 0; index < seed.length; index++) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  // Mix the low bits up into the high ones, so `% 360` sees the whole hash and not just its tail.
  hash ^= hash >>> 15
  hash = Math.imul(hash, 2246822507)
  hash ^= hash >>> 13
  return Math.abs(hash) % 360
}
