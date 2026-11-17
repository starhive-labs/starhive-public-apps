import { type BridgeObject, rawValueOf } from '@starhive/bridge'
import type { BadgeVariant } from '@starhive/ui'


/** Logical type keys this app's manifest provisions. */
export const CODE_LINK_KEY = 'codeLink'
export const WORK_ITEM_KEY = 'workItem'

/**
 * The manifest's attribute **keys** — the stable handle for addressing an attribute.
 *
 * Use these anywhere an attribute is named to the SDK (`<ObjectTable attributes>`, `useAttribute`).
 * A key survives an admin renaming the attribute; a display name does not.
 */
export const ATTR = {
  title: 'title',
  workItemId: 'workItemId',
  workItemLabel: 'workItemLabel',
  workItemTypeId: 'workItemTypeId',
  project: 'project',
  kind: 'kind',
  ref: 'ref',
  url: 'url',
  state: 'state',
  author: 'author',
} as const

/**
 * The same attributes' **display names**.
 *
 * StarQL matches on the display name, not the key, because it queries the search index — so a filter
 * needs these even though everything else uses `ATTR`.
 */
export const ATTR_NAME = {
  title: 'Title',
  workItemId: 'Work item id',
  workItemLabel: 'Work item name',
  workItemTypeId: 'Work item type id',
  project: 'Project',
  kind: 'Kind',
  ref: 'Ref',
  url: 'URL',
  state: 'State',
  author: 'Author',
} as const

/**
 * The work item a link belongs to.
 *
 * Stored on the link as its id, label and type rather than as a REFERENCE, because a reference can
 * point at one type and an admin may pick several. The Time Tracking app stores its entries the same
 * way for the same reason. The label and type are denormalised on purpose: there is no reference for
 * the host to resolve a name from, and a list of links must not cost one read per row to say what
 * each is attached to.
 */
export type LinkTarget = { id: string; label: string; typeId: string }

/** A target known only by its id — what a create falls back to before the label has been read. */
export function targetOf(id: string): LinkTarget {
  return { id, label: '', typeId: '' }
}

/**
 * The attribute values that tie a new link to [target], built with the caller's own [value] — which
 * resolves a key to an attribute id and drops a blank — so every place that creates a link writes
 * exactly the same fields.
 *
 * A label not read yet is left blank rather than filled with the id: `useWorkItem` shows the stored
 * label as the work item's name when the object cannot be read, and a uuid there is worse than
 * nothing.
 */
export function targetAttributes<T>(
  target: LinkTarget,
  value: (key: string, text: string) => T[],
): T[] {
  return [
    ...value(ATTR.workItemId, target.id),
    ...value(ATTR.workItemLabel, target.label),
    ...value(ATTR.workItemTypeId, target.typeId),
  ]
}

/**
 * StarQL for the links of one work item.
 *
 * Strict equality (`==`): for a TEXT attribute that matches the untokenized keyword, where plain `=`
 * goes through the analyser — and a hyphenated uuid is several tokens there, so one work item's id
 * could match another's.
 */
export function linksOf(workItemId: string): string {
  return `"${ATTR_NAME.workItemId}" == "${workItemId}"`
}

/**
 * StarQL for every link made since 0.31.0 — the ones that know their work item.
 *
 * Links made before then point at their work item only through the retired reference, so nothing
 * finds them per work item, and the key search links that work again with a row of its own. Left
 * counted, the old row and its replacement would count every merge request twice. Every read across
 * all links filters on this; the settings page offers to remove the old rows outright.
 */
export const CURRENT_LINKS = `"${ATTR_NAME.workItemId}" is not empty`

/** StarQL for the links made before 0.31.0 — the complement of [CURRENT_LINKS]. */
export const LEGACY_LINKS = `"${ATTR_NAME.workItemId}" is empty`

export type CodeConfig = {
  /**
   * The types a Code panel is offered on and may link from — any number of them.
   *
   * The setting is still called `workItemType`, from when it was one type, so an install keeps what
   * it chose. A value saved then is a single id rather than a list, and reads as a list of one.
   */
  workItemTypes: string[]
  /**
   * How a branch name is built — a template like `{initials}/{key}-{label}`.
   *
   * Empty means the app's own default. `{initials}` resolves per person rather than per install,
   * which is the reason it is a token at all: one literal would put the whole team's work under one
   * set of initials, which is worse than no folder.
   */
  branchNaming: string
  /** The `group/project` paths this workspace works in. Empty until an admin sets one. */
  projects: string[]
}

export const DEFAULT_CONFIG: CodeConfig = { workItemTypes: [], projects: [], branchNaming: '' }

/**
 * Read the install's settings.
 *
 * `project` is still read, singular, because installs made before this app had a list have one and
 * an admin should not have to retype it to keep working. Nothing writes it any more.
 *
 * `branchPrefix` is read the same way, and upgraded rather than dropped: it named the part before
 * the key, so the template that produces the same names is that prefix followed by the default. It
 * only applies while `branchNaming` is absent — saving the settings page writes the template and
 * blanks the old key, so an admin who deliberately empties the field gets the default rather than
 * the prefix they thought they had just removed.
 */
/**
 * What `branchPrefix` meant, spelled as a template.
 *
 * Pinned here rather than composed from [DEFAULT_BRANCH_TEMPLATE], which has since changed: an
 * upgrade exists to keep an install's names the same, so it has to reproduce the old rule and not
 * whatever the current default happens to be. Composing them would have turned `{initials}/` into
 * `{initials}/{initials}/{label}`.
 */
const PREFIX_ERA_TEMPLATE = '{key}-{label}'

function readNaming(raw: Record<string, unknown> | undefined): string {
  const naming = typeof raw?.branchNaming === 'string' ? raw.branchNaming.trim() : ''
  if (naming) return naming

  const prefix = typeof raw?.branchPrefix === 'string' ? raw.branchPrefix.trim() : ''
  if (!prefix) return ''
  return `${prefix.replace(/\/+$/, '')}/${PREFIX_ERA_TEMPLATE}`
}

export function readConfig(raw: Record<string, unknown> | undefined): CodeConfig {
  const listed = Array.isArray(raw?.projects)
    ? raw.projects
    : typeof raw?.projects === 'string'
      ? raw.projects.split('\n')
      : typeof raw?.project === 'string'
        ? [raw.project]
        : []

  return {
    workItemTypes: (Array.isArray(raw?.workItemType) ? raw.workItemType : [raw?.workItemType]).filter(
      (id): id is string => typeof id === 'string' && id.length > 0,
    ),
    branchNaming: readNaming(raw),
    projects: [
      ...new Set(
        listed
          .filter((entry): entry is string => typeof entry === 'string')
          .map((entry) => entry.trim().replace(/^\/+|\/+$/g, ''))
          .filter(Boolean),
      ),
    ],
  }
}

/**
 * The project a new branch for this work item should go in.
 *
 * Whatever it is already using, if it is using anything — a work item with a branch in the client
 * repo is almost certainly getting another one there. Otherwise the first configured project, which
 * is a guess, which is why the dialog lets it be changed.
 */
export function defaultProject(configured: string[], existing: string[]): string {
  const used = existing.find((project) => project && configured.includes(project))
  return used ?? existing.find(Boolean) ?? configured[0] ?? ''
}

export {
  branchNameFrom,
  branchNameProblem,
  BRANCH_TOKENS,
  DEFAULT_BRANCH_TEMPLATE,
  initialsOf,
  MAX_BRANCH_NAME,
  slugify,
  unknownTokens,
} from './branchName'

/**
 * Whole days since an ISO timestamp, or undefined when there is nothing to count from.
 *
 * Days rather than hours: the question this page asks is "has this been sitting", and nothing
 * sitting for four hours is sitting.
 */
export function daysSince(iso: string | undefined, now: Date = new Date()): number | undefined {
  if (!iso) return undefined
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return undefined
  return Math.max(0, Math.floor((now.getTime() - then) / 86_400_000))
}

/** What a stored link says, read off the object. */
export type StoredLink = {
  objectId: string
  project: string
  kind: string
  ref: string
  title: string
  url: string
  /** What GitLab last said, or '' — shown when a live read fails. */
  state: string
  author: string
}

/**
 * Read a link object into a plain shape.
 *
 * Takes the resolved columns rather than a type schema, because that is what the caller already has
 * from `useAttributes`, and reads raw values: these are identifiers to call GitLab with, not text to
 * show, and `display` would give the formatted string.
 */
export function readLink(
  object: BridgeObject,
  attributeIdOf: (key: string) => string | undefined,
): StoredLink {
  const value = (key: string) => {
    const id = attributeIdOf(key)
    return (id ? rawValueOf(object, id) : undefined) ?? ''
  }
  return {
    objectId: object.id,
    project: value(ATTR.project),
    kind: value(ATTR.kind),
    ref: value(ATTR.ref),
    title: value(ATTR.title),
    url: value(ATTR.url),
    state: value(ATTR.state),
    author: value(ATTR.author),
  }
}

/**
 * How a state reads as a badge.
 *
 * `closed` is a warning rather than a neutral: a merge request that ended without merging is a loose
 * end on the work item it is attached to, and the panel exists to make exactly that visible. Everything
 * still in flight — open, active, no commits yet — is ordinary, so it stays neutral.
 */
export function stateVariant(state: string): BadgeVariant {
  switch (state.toLowerCase()) {
    case 'merged':
      return 'success'
    case 'closed':
      return 'warning'
    default:
      return 'default'
  }
}
