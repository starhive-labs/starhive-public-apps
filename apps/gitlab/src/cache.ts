/**
 * A small read-through cache for answers from GitLab.
 *
 * Every panel open was re-asking GitLab everything it already knew: one call per link, another per
 * branch for its merge requests, and up to two more for any branch GitLab called merged. Flipping
 * between five work items cost dozens of calls to learn nothing new, against an API with a rate limit
 * and a platform that does not yet meter egress.
 *
 * Two layers, because they fail differently. An in-memory map survives the component remount that
 * follows every write — the one `useReloadAfterIndex` triggers — which is where the most obviously
 * wasted calls were. `sessionStorage` survives the iframe being torn down and rebuilt, which is what
 * a panel open actually is, and is available because each install is served from its own origin with
 * `allow-same-origin`. It is deliberately session storage and not local: this is somebody's private
 * repository data, and it has no business outliving the browsing session on disk.
 *
 * Storage is allowed to fail. A private window, blocked site data, a quota — all of it degrades to
 * the memory layer, which degrades to simply calling GitLab. Nothing here is load-bearing.
 */

type Entry = { value: unknown; at: number }

const PREFIX = 'gitlab-cache:'
/** Above this, an answer is used but not persisted — a big list is not worth a quota failure. */
const MAX_PERSISTED_BYTES = 32 * 1024

const memory = new Map<string, Entry>()

function session(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    // Accessing the property itself throws where site data is blocked.
    return null
  }
}

function readEntry(key: string): Entry | undefined {
  const hit = memory.get(key)
  if (hit) return hit
  try {
    const raw = session()?.getItem(PREFIX + key)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as Entry
    memory.set(key, parsed)
    return parsed
  } catch {
    return undefined
  }
}

function writeEntry(key: string, entry: Entry): void {
  memory.set(key, entry)
  try {
    const raw = JSON.stringify(entry)
    if (raw.length > MAX_PERSISTED_BYTES) return
    session()?.setItem(PREFIX + key, raw)
  } catch {
    // Quota, or storage that refuses to be written. The memory layer still holds it.
  }
}

/**
 * Answer from cache when the answer is younger than [ttlMs], otherwise call [load] and keep what it
 * says.
 *
 * A failed load is never cached: the next open should ask again rather than repeat an error for the
 * rest of the session.
 */
export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const entry = readEntry(key)
  if (entry && Date.now() - entry.at < ttlMs) return entry.value as T

  const value = await load()
  writeEntry(key, { value, at: Date.now() })
  return value
}

/** Forget everything under [prefix] — after a write that makes those answers wrong. */
export function invalidate(prefix: string): void {
  for (const key of [...memory.keys()]) {
    if (key.startsWith(prefix)) memory.delete(key)
  }
  try {
    const store = session()
    if (!store) return
    for (const key of Object.keys(store)) {
      if (key.startsWith(PREFIX + prefix)) store.removeItem(key)
    }
  } catch {
    // Nothing to do: the memory layer is already clear, and a stale persisted entry expires anyway.
  }
}

/** Forget everything. What "Refresh" means. */
export function invalidateAll(): void {
  invalidate('')
}
