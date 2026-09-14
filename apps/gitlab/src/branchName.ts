/**
 * Naming a branch after a work item.
 *
 * Deliberately free of every import: these are the rules, and rules with no dependencies can be read
 * and run on their own. `branchName.test.mjs` beside this file does exactly that.
 */
/**
 * The longest branch name this app will produce.
 *
 * Git itself has no documented limit on a ref name, but every ref is a path component on disk, and
 * the common filesystems stop at 255 bytes. 200 leaves room for the remote's own prefixes and for a
 * name to survive being quoted in a shell, and is far past what anyone reads.
 */
export const MAX_BRANCH_NAME = 200

/**
 * Make one segment of a branch name safe.
 *
 * `git check-ref-format` forbids more than most slug functions know about: control characters, a
 * space, `~ ^ : ? * [ \`, `..`, `@{`, a leading or trailing `/` or `.`, `//`, and a `.lock` ending.
 * Rather than police that list, everything outside `a-z0-9` collapses to a single hyphen, which
 * cannot express any of it.
 */
export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      // NFKD splits an accented letter into the letter and a combining mark, so `ö` becomes `o` plus
      // a mark. Dropping the marks is what turns "Förbättra sökningen" into `forbattra-sokningen`;
      // without it every accent became a hyphen and Swedish labels came out as `fo-rba-ttra`.
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  )
}

/**
 * Keep a key readable rather than slugging it.
 *
 * A sequence is an identifier, not prose, so the dots and underscores a slug would flatten are kept:
 * only the characters git refuses are replaced. Case is left as stored here and decided by the
 * template — see [branchNameFrom].
 */
export function keyish(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
}

/**
 * Someone's initials, for a prefix that should say who is working.
 *
 * From the display name where there is one — "Mathias Edblom" is `me` — and otherwise from the local
 * part of the email, which is the only other thing the handshake carries. Lowercase, because a folder
 * of shouted initials reads badly next to a key that is genuinely uppercase.
 */
export function initialsOf(person: { name?: string; email?: string }): string {
  const words = (person.name ?? '')
    .split(/\s+/)
    .map((word) => word.replace(/[^A-Za-z]/g, ''))
    .filter(Boolean)
  if (words.length > 0) return words.map((word) => word[0]).join('').toLowerCase().slice(0, 4)

  // No name to go on — which is what a host too old to send one leaves us with. An address often
  // still carries the person: `mathias.edblom@` is initials waiting to happen, whereas `mathias@`
  // has nothing to take apart and is a perfectly good folder name as it stands.
  const local = (person.email ?? '').split('@')[0]
  const parts = local.split(/[._+-]+/).filter(Boolean)
  if (parts.length > 1) {
    return parts
      .map((part) => part.replace(/[^A-Za-z0-9]/g, '')[0] ?? '')
      .join('')
      .toLowerCase()
      .slice(0, 4)
  }
  return local.replace(/[^A-Za-z0-9]/g, '').toLowerCase().slice(0, 12)
}

/**
 * The tokens that mean something whatever type a work item is.
 *
 * Everything else in braces is looked up as one of the work item's **attributes, by display name** —
 * `{Manufacturer}`, `{Serial number}`, `{Id}`. These three are the ones no attribute name can
 * provide: `{initials}` belongs to the person rather than the object, and `{key}` and `{label}` name
 * a *role* — the type's SEQUENCE and whichever attribute it marks `isLabel` — so a default template
 * works on a type whose key is called `Key` and on one where it is called `Ref`.
 */
export const BRANCH_TOKENS = ['initials', 'key', 'label'] as const

/**
 * How a token's own case decides its value's case.
 *
 * `{key}` gives `hardware-1` and `{KEY}` gives `HARDWARE-1`. The template is the only place that can
 * answer this: a sequence's value is whatever the workspace's prefix happens to be, and there is no
 * telling from here whether `HARDWARE-1` is an identifier a team writes in capitals or just what a
 * type called Hardware generated. So neither casing is hardcoded, and the admin writes the one they
 * want in the shape of the token itself rather than learning a second piece of syntax.
 */
function cased(value: string, token: string): string {
  const shouted = token === token.toUpperCase() && token !== token.toLowerCase()
  return shouted ? value.toUpperCase() : value.toLowerCase()
}

/**
 * What a branch is called when nobody has said otherwise.
 *
 * Whose it is and what it is about — the two things true of every type. A key is the better name
 * when there is one, but a SEQUENCE is not something a type has by default, and a default that
 * silently drops half of itself on the types that lack one is a worse default than one that never
 * promised the key. Anyone with keys writes `{initials}/{key}-{label}` and gets them.
 */
export const DEFAULT_BRANCH_TEMPLATE = '{initials}/{label}'

/**
 * Tokens that name neither a role nor an attribute of the work item's type.
 *
 * So the settings page can say so, rather than resolving them to nothing and letting a branch that
 * came out short be the first anyone hears of it. Pass the type's attribute names; without them only
 * the roles are known, which is all that can be checked before a type is configured.
 */
export function unknownTokens(template: string, attributeNames: string[] = []): string[] {
  const known = new Set<string>([
    ...BRANCH_TOKENS,
    ...attributeNames.map((name) => name.trim().toLowerCase()),
  ])
  return [...new Set([...template.matchAll(/\{([^}]*)\}/g)].map((match) => tokenKey(match[1])))]
    .filter(Boolean)
    .filter((name) => !known.has(name))
}

/** A token as it is looked up: trimmed and case-folded, since its case only chooses the output's. */
function tokenKey(name: string): string {
  return name.trim().toLowerCase()
}

/**
 * Make a rendered template into something git will accept.
 *
 * The separators are the whole problem here. A template is written for the case where every token
 * has a value, so `{initials}/{key}-{label}` on a work item with no key renders as `me/-computer-1`
 * — the hyphen belonged to a token that is not there. Rather than make the template language
 * express that, every separator left adjacent to nothing is dropped, which is what someone writing
 * the template meant by it.
 */
function tidy(text: string): string {
  return (
    text
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9._/-]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/\.{2,}/g, '.')
      .replace(/\/{2,}/g, '/')
      // A separator orphaned by an empty token, either side of a slash.
      .replace(/-*\/-*/g, '/')
      .split('/')
      .map((segment) => segment.replace(/^[-.]+|[-.]+$/g, ''))
      .filter(Boolean)
      .join('/')
      // `.lock` is the one ending git refuses outright, and a template may end in a literal dot.
      .replace(/\.lock$/i, '-lock')
  )
}

/**
 * The branch name for a work item, as an admin's template describes it.
 *
 * `{initials}/{key}-{label}` gives `me/STAR-123-the-name`. Each token is rendered the way that kind
 * of value should read: a key keeps its own case because `STAR-123` is an identifier and lowercasing
 * it makes the branch stop matching the thing it names, while a label is slugged because it is a
 * sentence. Literal text between tokens is kept as typed, apart from what git refuses.
 *
 * The label is the elastic part. Everything else is reserved out of the length budget first — losing
 * a key or a prefix changes what the branch *is*, where losing the tail of a label only changes how
 * much of it there is — and the cut goes back to a whole word, because a name ending mid-word reads
 * like a mistake rather than a limit.
 *
 * A template that renders to nothing at all still has to produce something, so it falls back to a
 * short suffix of the object's id. Nobody types that, but it is valid and it is unique.
 */
export function branchNameFrom(options: {
  /** The admin's template. Empty or missing means [DEFAULT_BRANCH_TEMPLATE]. */
  template?: string
  /** The work item's SEQUENCE, if its type has one. */
  key?: string
  label?: string
  /**
   * Every attribute of the work item, by display name, so a template can name one directly.
   *
   * Display name and not key, because these are written by an admin in a settings field against a
   * type this app does not own: `{Serial number}` is what they see in the product, and the manifest
   * keys that address the app's own attributes do not exist for somebody else's type.
   */
  attributes?: Record<string, string>
  /** Resolved per viewer: `{initials}` is the point of having the token at all. */
  person?: { name?: string; email?: string }
  /** Used only when there is nothing else to name it after. */
  objectId?: string
  /** Distinguishes a second branch for the same work item. */
  suffix?: string
  maxLength?: number
}): string {
  const limit = options.maxLength ?? MAX_BRANCH_NAME
  const template = (options.template ?? '').trim() || DEFAULT_BRANCH_TEMPLATE
  const person = options.person ?? {}
  const tail = slugify(options.suffix ?? '') ? `-${slugify(options.suffix ?? '')}` : ''

  // By display name, folded, so `{Serial number}` and `{serial NUMBER}` find the same attribute —
  // a token's case chooses the output's case and must not also decide whether it resolves at all.
  const byName = new Map(
    Object.entries(options.attributes ?? {}).map(([name, value]) => [tokenKey(name), value]),
  )

  const roles: Record<string, string> = {
    initials: slugify(initialsOf(person)),
    key: keyish(options.key ?? ''),
  }

  /*
   * A role with a value beats an attribute of the same name; an empty one falls through to it.
   *
   * They agree wherever it matters — on a type whose SEQUENCE is called `Key`, both readings of
   * `{key}` are the same value — and where they disagree the role is what a template written for
   * "whatever this type calls its key" meant. Falling through matters for the type that has no
   * SEQUENCE but does have an attribute called `Key` holding the same idea by hand: there `{key}`
   * should find it rather than resolve to nothing on a technicality about which one is a role.
   */
  const label = slugify(options.label ?? '')
  const resolve = (name: string, forLabel: string) => {
    const key = tokenKey(name)
    return key === 'label' ? forLabel : roles[key] || keyish(byName.get(key) ?? '')
  }

  const build = (forLabel: string) =>
    tidy(
      template.replace(/\{([^}]*)\}/g, (_, name: string) =>
        cased(resolve(name, forLabel), name),
      ),
    )

  /*
   * A name has to identify the *object*, and `{initials}` does not.
   *
   * Not because an object might lack a label — a type nominates one and it is filled in — but
   * because the app does not always receive it: the panel is handed an objectId and may be refused
   * the read, which is the state this app spent an afternoon in. With the default template that
   * rendered as `me`: a valid branch name saying who is working and nothing about what on, and the
   * same one for every object they touch. Anything that came out of the object counts here; only
   * the person does not.
   */
  const named = [...template.matchAll(/\{([^}]*)\}/g)]
    .map((match) => match[1])
    .filter((name) => tokenKey(name) !== 'initials')
    .some((name) => resolve(name, label) !== '')

  const fromId = (() => {
    const id = (options.objectId ?? '')
      .replace(/[^a-z0-9]/gi, '')
      .slice(-8)
      .toLowerCase()
    return id ? `work-${id}` : 'work'
  })()

  // The id stands in for the label where the template asks for one, so the folder survives; where
  // it asks for no such thing there is nothing to stand in for, and the id is the whole name.
  const startFrom = named ? label : /\{\s*label\s*\}/i.test(template) ? fromId : ''
  // `{label}` may appear more than once, in which case cutting one character off it takes that many
  // characters off the name — subtracting the whole overflow from the label would trim it to almost
  // nothing. Spread the cut across the appearances and let the loop converge.
  const appearances = Math.max(1, [...template.matchAll(/\{label\}/gi)].length)
  let words = startFrom
  for (let pass = 0; pass < 6; pass += 1) {
    const over = build(words).length + tail.length - limit
    if (over <= 0) break
    let shorter = words.slice(0, Math.max(0, words.length - Math.ceil(over / appearances)))
    const lastBreak = shorter.lastIndexOf('-')
    // Only back to a word boundary when that still uses most of the room; otherwise one long word
    // would shrink the name to nothing.
    if (lastBreak > shorter.length / 2) shorter = shorter.slice(0, lastBreak)
    words = shorter.replace(/-+$/g, '')
  }

  let core = named || startFrom ? build(words) : ''
  if (!core) core = fromId

  const room = Math.max(limit - tail.length, 1)
  if (core.length > room) core = tidy(core.slice(0, room))
  return `${core}${tail}`
}

/** Why a branch name would be refused, or null when it is fine. */
export function branchNameProblem(name: string): string | null {
  if (!name.trim()) return 'A branch needs a name.'
  if (name.length > MAX_BRANCH_NAME) return `Too long — ${MAX_BRANCH_NAME} characters at most.`
  if (/\s/.test(name)) return 'A branch name cannot contain spaces.'
  if (/[~^:?*[\\]/.test(name)) return 'A branch name cannot contain ~ ^ : ? * [ or \\.'
  if (name.includes('..') || name.includes('@{')) return 'A branch name cannot contain .. or @{.'
  if (name.startsWith('/') || name.endsWith('/') || name.includes('//')) {
    return 'A branch name cannot start or end with /, or contain //.'
  }
  if (name.startsWith('.') || name.endsWith('.') || name.endsWith('.lock')) {
    return 'A branch name cannot start or end with a dot, or end with .lock.'
  }
  return null
}
