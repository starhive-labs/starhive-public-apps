/**
 * `@starhive/bridge/protocol` — the wire contract shared by BOTH sides of the
 * app-platform bridge: the SDK running inside the sandboxed app iframe and the
 * host running in the Starhive platform UI.
 *
 * This module is intentionally framework-free (no React, no DOM globals beyond
 * structural types) so the host can import the exact same types and runtime
 * guards the app is built against.
 *
 * Transport model (see the host's `AppExtensionIframe` for the other half):
 *   1. The iframe boots, generates a `nonce`, and `postMessage`s a {@link ReadyMessage}
 *      to `window.parent` (targetOrigin "*", since the app may not know the host origin).
 *   2. The host validates `event.origin` against the per-install allowlist and that
 *      `event.source === iframe.contentWindow`, then creates a `MessageChannel`,
 *      keeps `port1`, and posts an {@link InitMessage} (echoing the nonce + initial
 *      {@link HostContext}) back to the iframe, transferring `port2`.
 *   3. From then on ALL request/response/push traffic flows over the port. A port is
 *      unforgeable by other frames, and the echoed nonce proves the init answered THIS
 *      iframe's ready — so an attacker window cannot inject a fake init.
 */

/**
 * The protocol this build speaks.
 *
 * v2 enriched the READ shape of an object's attribute values: `values` went from `string[]` to
 * {@link BridgeAttributeValue}`[]`, carrying the label/name/state the host already resolved. Writes
 * were deliberately left alone — an app still writes plain strings.
 *
 * The host serves whichever version an app announced at handshake (down to
 * {@link MIN_BRIDGE_PROTOCOL_VERSION}), so a bundle built against v1 keeps working untouched.
 */
export const BRIDGE_PROTOCOL_VERSION = 2

/** Oldest app protocol the host still answers. Below this the handshake is refused. */
export const MIN_BRIDGE_PROTOCOL_VERSION = 1

/** The version both sides can speak: an app never gets a shape newer than it asked for. */
export function negotiateProtocolVersion(appVersion: number): number {
  if (!Number.isFinite(appVersion)) return MIN_BRIDGE_PROTOCOL_VERSION
  return Math.min(
    Math.max(Math.trunc(appVersion), MIN_BRIDGE_PROTOCOL_VERSION),
    BRIDGE_PROTOCOL_VERSION,
  )
}

/** The extension points an app module can be mounted at. */
export type SlotKind = 'globalPage' | 'objectPanel' | 'widget' | 'settingsPage' | 'macro'

export type ToastVariant = 'success' | 'error' | 'info' | 'warning'

/** Stable, serializable error codes returned in {@link BridgeResponse}. */
export const BridgeErrorCode = {
  Timeout: 'TIMEOUT',
  BadRequest: 'BAD_REQUEST',
  Forbidden: 'FORBIDDEN',
  NotFound: 'NOT_FOUND',
  UnknownMethod: 'UNKNOWN_METHOD',
  Internal: 'INTERNAL',
  ChannelClosed: 'CHANNEL_CLOSED',
} as const
export type BridgeErrorCode = (typeof BridgeErrorCode)[keyof typeof BridgeErrorCode]

export type BridgeError = { code: string; message: string }

// ---------------------------------------------------------------------------
// Domain shapes exposed to the app (a deliberately trimmed view of the native
// Starhive types — apps never see internal value `details`).
// ---------------------------------------------------------------------------

/**
 * Attribute value as an app **writes** it. Always string-encoded per the public API
 * (REFERENCE = target UUID, DATE = "YYYY-MM-DD", DECIMAL/TEXT = raw).
 *
 * Reads are richer — see {@link BridgeAttributeValues}. The two shapes are deliberately separate:
 * enriching a read must not make writing harder, so a write stays a list of strings.
 */
export type BridgeAttributeInput = {
  attributeId: string
  values: string[]
}

/** The object an app's REFERENCE value points at, as far as drawing it needs. */
export type BridgeReferenceDetails = {
  objectId: string
  /** The target's human label — what the product shows in a reference chip. */
  label: string
  typeId: string
  spaceId?: string
  /** Absolute URL of the target's avatar thumbnail, when it has one. */
  avatarUrl?: string
  /**
   * The 20px icon of the target's **own** type, shown when it has no avatar.
   *
   * Per value rather than per attribute on purpose: a `REFERENCE` that includes child types can hold
   * objects of several subtypes, and each carries its own icon — which is how the product resolves it
   * too. Absent when that type has no icon, or when the host could not resolve one.
   */
  iconUrl?: string
  /** That icon's configured tint. */
  iconColor?: string
}

/** A USER value's identity. `isDeleted` users carry nothing else — there is nothing left to show. */
export type BridgeUserDetails = {
  id: string
  name?: string
  email?: string
  isDeleted?: boolean
}

/**
 * A WORKFLOW value's state.
 *
 * No colour here on purpose. A state's colour is a property of the *workflow*, not of one object's
 * value, so it travels once on the attribute's schema ({@link BridgeAttributeConfiguration.states})
 * rather than being repeated on every row of a 200-row table. Join on `id` to colour a badge.
 */
export type BridgeStateDetails = {
  id: string
  name: string
  /** True for a terminal state — the product draws a checkmark. */
  isEndState: boolean
}

/** The colours a workflow state can be given. Matches the product's own palette. */
export type BridgeStateColor = 'GRAY' | 'RED' | 'GREEN' | 'BLUE' | 'YELLOW' | 'ORANGE' | 'PURPLE'

/**
 * One state of the workflow driving a `WORKFLOW` attribute.
 *
 * The full list, in the workflow's order — so an app can colour a status badge, and can also draw
 * something the value alone could never support: a column per state on a board, a legend, a filter.
 */
export type BridgeWorkflowState = {
  id: string
  name: string
  isEndState: boolean
  /** Absent when the workspace never set one, or when the colour service could not be reached. */
  color?: BridgeStateColor
}

/** A MEDIA value's file. URLs are absolute and already authorised for this user. */
export type BridgeMediaDetails = {
  fileName: string
  contentType: string
  fileSize: number
  thumbnailUrl?: string
  previewUrl?: string
}

export type BridgeLocationDetails = {
  latitude: number
  longitude: number
}

export type BridgeSlaDetails = {
  status: 'RUNNING' | 'PAUSED' | 'STOPPED'
  startDateTime?: string
  dueDateTime?: string
  remainingDuration?: string
  timeTarget?: string
  totalDuration?: string
}

/**
 * One attribute value as an app **reads** it: the raw string plus whatever the host had already
 * resolved about it.
 *
 * Only `value` and `valueId` are guaranteed. Every enrichment is optional and legitimately absent —
 * the read path does not always compute it — so a renderer falls back to `value` rather than
 * blanking. Nothing here is privileged: it is all readable by this user through the public API, and
 * a value they may *not* see arrives as {@link restricted} with no content at all.
 */
export type BridgeAttributeValue = {
  /** The string encoding, identical to what protocol v1 returned. */
  value: string
  valueId: string
  /**
   * Pre-resolved human text for this value — a reference's label, a user's name, a state's name.
   *
   * Carries what only the host knew. It does NOT apply the attribute's own configuration (option
   * names, number formatters, date granularity): the app has that on
   * {@link BridgeAttribute.configuration} and formatting from it costs no round trip, whereas
   * resolving it here would cost a type fetch on every object read.
   */
  display?: string
  ref?: BridgeReferenceDetails
  user?: BridgeUserDetails
  state?: BridgeStateDetails
  media?: BridgeMediaDetails
  location?: BridgeLocationDetails
  sla?: BridgeSlaDetails
  /**
   * The value exists but this user may not see it. `value` is empty and no enrichment is present —
   * render a "restricted" affordance, never a blank.
   */
  restricted?: true
}

/** An attribute's values on an object, as read. */
export type BridgeAttributeValues = {
  attributeId: string
  values: BridgeAttributeValue[]
}

export type BridgeObject = {
  id: string
  typeId: string
  spaceId: string
  attributes: BridgeAttributeValues[]
}

/**
 * The v1 read shape, kept so the host can still answer a bundle built against protocol 1 (values
 * flattened back to their strings). Nothing in this SDK produces it — the host downgrades on the way
 * out. New code should not reference it.
 *
 * @deprecated superseded by {@link BridgeObject} at protocol v2.
 */
export type BridgeObjectV1 = {
  id: string
  typeId: string
  spaceId: string
  attributes: BridgeAttributeInput[]
}

/** What an aggregation may ask for. `count` needs no attribute; the rest do. */
export type BridgeAggregateOperation = 'count' | 'sum' | 'avg' | 'min' | 'max'

export type BridgeAggregateRequest = {
  /** The provisioned type to aggregate over. Required, exactly as it is for a query. */
  typeKey: string
  /** A StarQL predicate, without `order by` — the same string a query takes. */
  where?: string
  operation: BridgeAggregateOperation
  /**
   * The attribute to aggregate, by manifest key. Required for everything except `count`, which
   * counts objects and so has nothing to aggregate over.
   */
  attribute?: string
  /**
   * Split the answer by this attribute's value, by manifest key.
   *
   * One dimension, not several. The index supports more and the day an app needs a matrix this is
   * where it goes; a number and a breakdown is what a dashboard is made of.
   */
  groupBy?: string
}

export type BridgeAggregateResult = {
  /** The single figure, when nothing was grouped. */
  value?: number
  /** The figure per group, keyed by the group-by attribute's value, when something was. */
  groups?: Record<string, number>
  /** How many objects the predicate matched, whether or not they were grouped. */
  total: number
}

export type BridgeQueryResult = {
  result: BridgeObject[]
  total: number
  pageSize: number
  isLast: boolean
}

/** How a numeric attribute is formatted. Mirrors the product's `NumberFormatterTypeConfiguration`. */
export type BridgeNumberFormatterType = 'NONE' | 'CURRENCY' | 'UNIT' | 'PERCENTAGE'

/**
 * The attribute options a renderer needs, trimmed from the product's much larger
 * `AttributeConfiguration`. Only what drawing or editing a value requires.
 */
export type BridgeAttributeConfiguration = {
  /** `OPTION`: the choices, so an app can turn a stored option id into its name. */
  options?: { id: string; name: string }[]
  /** `PRIORITY`: the levels and their colours. */
  priorities?: { id: string; name: string; color: string }[]
  /** `RATING`. */
  maxRating?: number
  allowHalfValues?: boolean
  /** `INTEGER` / `DECIMAL` / `CALCULATED`. */
  numberFormatterType?: BridgeNumberFormatterType
  /** The currency code, unit name or percentage mode the formatter above takes. */
  numberFormatterValue?: string
  /** `DATE_RANGE`: whether the range carries times. */
  dateRangeType?: 'DATE' | 'DATE_TIME'
  /** `REFERENCE`: the type the reference points at. */
  targetTypeId?: string
  /** `SEQUENCE`. */
  sequencePrefix?: string
  /**
   * `WORKFLOW`: the states of the driving workflow, with their colours.
   *
   * Schema, so it rides on the type rather than on every value. Absent when the host could not
   * resolve the workflow — a renderer defaults the colour rather than failing.
   */
  states?: BridgeWorkflowState[]
}

/**
 * Attribute metadata exposed to apps so they can resolve an attribute at runtime and render its
 * values the way the product does.
 */
export type BridgeAttribute = {
  id: string
  /**
   * The manifest's stable logical key for this attribute (`"status"`, `"dueDate"`), for an attribute
   * **this app provisioned**. Absent for a native attribute the app did not declare — those can only
   * be addressed by {@link name}.
   *
   * Prefer this over `name` everywhere: a name is a display string an admin may rename, a key is
   * identity. See {@link HostContext.attributeKeyToId}.
   */
  key?: string
  name: string
  attributeTypeCode: string
  isLabel: boolean
  /** True when the attribute demands a value (min cardinality ≥ 1). */
  required?: boolean
  /** True when it holds more than one value. */
  multiValue?: boolean
  /**
   * For a `WORKFLOW` attribute: the workflow driving it. Present so an app can tell which attribute
   * carries status without knowing the type by heart.
   */
  workflowId?: string
  configuration?: BridgeAttributeConfiguration
}

/**
 * A move an object may make right now, from the state it is in.
 *
 * Transitions are the only way a `WORKFLOW` value changes: writing a state id on its own is refused
 * (`TRANSITION_NOT_SUPPLIED`). Which of them are offered depends on the object's current state and on
 * the transition's conditions, so this is asked per object, not per type, and asked again after every
 * successful move.
 */
export type BridgeTransition = {
  id: string
  /** What the transition is called — the label to put on the button ("Start", "Complete"). */
  name: string
  /** The state the object lands in. Write this as the attribute's value alongside the transition. */
  toStateId: string
  fromStateId?: string
  /** True for a move out of "no state yet" — an object whose workflow value was never set. */
  isFromEmptyState: boolean
  /**
   * The transition has a screen: Starhive expects the screen's attributes to be supplied with it, in
   * the same update. A workflow provisioned from a manifest never has one.
   */
  requiresScreen: boolean
}

/**
 * An external system this app's manifest declared, as far as the app needs to know about it.
 *
 * Deliberately thin: an app knows what it declared, and for a remote whose address the customer
 * supplied, that address is the customer's business and not the app's. What the app cannot know
 * without asking is whether an admin has finished connecting it — hence [configured].
 */
export type BridgeRemote = {
  key: string
  name: string
  /** True when an admin has supplied everything this remote needs; false means calls will fail. */
  configured: boolean
}

/** Options for {@link BridgeMethodMap}'s `remote.fetch`, in the shape `fetch` takes them. */
export type BridgeFetchInit = {
  method?: string
  headers?: Record<string, string>
  body?: string
  /**
   * How long this answer may be reused, in seconds. Omitted or zero means never, which is the
   * default.
   *
   * The cache lives in the host, beside the credential, so it is shared by everyone looking at the
   * same thing — ten people opening one object ask the far end once. An app cannot achieve that on
   * its own: every viewer is a separate browser and an app has no server to put a cache in.
   *
   * Only a plain successful `GET` or `HEAD` is ever kept, never longer than the host's ceiling, and
   * anything this app writes through the same remote clears it. Say what the resource is actually
   * like: a project's default branch is good for hours, an open merge request for a minute or two.
   */
  cacheSeconds?: number
}

/** What the external system answered, as it crosses the port. */
export type BridgeFetchResult = {
  status: number
  headers: Record<string, string>
  body: string | null
}

export type BridgeTransitionsResult = {
  attributeId: string
  workflowId: string
  /** The state the object is in now, or null when it has none yet. */
  currentStateId: string | null
  /** That state's display name, when it has a value. */
  currentStateName?: string
  transitions: BridgeTransition[]
}

/**
 * A type's icon, as the product draws it beside an object.
 *
 * Absolute CDN URLs, so an app renders one with a plain `<img>` — the type icons are hosted, unlike
 * the product's UI chrome icons which come from an SVG sprite an app bundle cannot reach.
 */
export type BridgeTypeIcon = {
  iconId: string
  /** 20px, for a chip or a picker row. */
  url20: string
  /** 48px, for a card or a header. */
  url48: string
  /** The icon's configured tint. */
  color?: string
}

export type BridgeType = {
  id: string
  name: string
  spaceId: string
  /**
   * Always present. A type with no icon configured — which is every app-provisioned type, since
   * provisioning has no icon parameter — gets the product's default, so an app draws what Starhive
   * Core draws rather than falling back to initials.
   */
  icon: BridgeTypeIcon
  attributes: BridgeAttribute[]
}

/** Lightweight type reference returned by `types.list` (for config/reference pickers). */
export type BridgeTypeRef = {
  id: string
  name: string
  spaceId: string
}

export type StarhiveUser = {
  id: string
  name?: string
  email: string
}

/**
 * A Mantine-agnostic snapshot of Starhive's design tokens, pushed by the host so an app can match the
 * product's look — colors, radii, spacing, typography and shadows. The app applies these as CSS
 * variables (see the example apps' `useApplyTheme`) and re-applies whenever the host pushes an update.
 */
export type StarhiveTheme = {
  colorScheme: 'light' | 'dark'
  fontFamily: string
  colors: {
    /** Brand/action color — buttons, links, focus rings. */
    primary: string
    /** Hover/active shade of {@link primary}. */
    primaryHover: string
    /** Foreground on top of {@link primary} (e.g. a button label). */
    onPrimary: string
    /** Page background. */
    background: string
    /** Card/input/surface background. */
    surface: string
    /** Primary text. */
    text: string
    /** Secondary/dimmed text. */
    textMuted: string
    /** Hairline border color. */
    border: string
    positive: string
    warning: string
    negative: string
  }
  radius: { sm: string; md: string; lg: string }
  spacing: { xs: string; sm: string; md: string; lg: string; xl: string }
  fontSizes: { xs: string; sm: string; md: string; lg: string; xl: string }
  fontWeights: { normal: number; semiBold: number; bold: number }
  shadows: { sm: string; md: string }
}

/** The context the host hands the iframe at handshake and re-pushes on change. */
export type HostContext = {
  installationId: string
  /** Which slot this iframe was mounted at. `config.set` is only valid on `settingsPage`. */
  slot: SlotKind
  workspaceId: string
  spaceId?: string
  /** Present for the `objectPanel` slot (the object being viewed). */
  objectId?: string
  /**
   * Present for the `macro` slot: the arguments the writer filled in when inserting this macro into
   * the document, keyed by the manifest's `params[].key`. Distinct from `config.get()`, which is the
   * install's admin settings — two macros of the same module on one page get different params.
   */
  macroParams?: Record<string, unknown>
  /**
   * Present for the `macro` slot: what this block last saved with `macro.setState`, or absent for a
   * block that has never saved anything.
   *
   * Params and state are both per block and both live on the document node, but they belong to
   * different people: params are the writer's answers to the insert dialog and only the host's own
   * dialog may change them, while state is the app's, written as the reader or writer works. A
   * drawing, a chosen tab, a collapsed section — anything the block must remember and nothing else
   * can hold, because an app has no per-block storage of its own.
   */
  macroState?: Record<string, unknown>
  /**
   * Present for the `macro` slot: whether this block can save state *right now*.
   *
   * False on a page being read rather than written — there is no document transaction to write into,
   * so `macro.setState` would be refused. An app needs to know before it offers: a block that shows
   * an Edit button to a reader is a block whose Edit button does nothing, and the reader finds that
   * out only after doing the work.
   *
   * Absent from a host that predates this, which is read as "allowed" rather than "forbidden" — an
   * older host answers a save honestly, and an app that hid its own controls on a missing field
   * would be broken by silence.
   */
  macroStateWritable?: boolean
  user: StarhiveUser
  theme: StarhiveTheme
  /** Logical type key (e.g. "timeEntry") -> provisioned Starhive typeId. */
  typeKeyToId: Record<string, string>
  /**
   * `"typeKey.attributeKey"` (e.g. `"timeEntry.workItem"`) -> provisioned Starhive attributeId.
   *
   * The stable way to address an attribute. Without it an app's only option is matching on display
   * name, which breaks the moment an admin renames the attribute — so prefer this, or
   * {@link BridgeAttribute.key}, over `name` everywhere.
   */
  attributeKeyToId: Record<string, string>
  /** "workflowKey.stateKey" -> provisioned workflow stateId, to resolve a WORKFLOW attribute value. */
  stateKeyToId: Record<string, string>
  /**
   * `"typeKey.attributeKey"` -> the typeId a config-bound `REFERENCE` points at.
   *
   * The types an admin nominated for this app through its manifest's `scopes.read`, as opposed to
   * the ones it provisioned for itself. An app may **read** objects and schemas of these — which is
   * how it learns what the thing it just linked is called, or which of that type's attributes is a
   * key — and may not create, change or delete them. Empty for an app that declares no read scope.
   */
  readTypeIds?: string[]
}

// ---------------------------------------------------------------------------
// Method map — single source of truth for args/result of every bridge method.
// Both the SDK client and the host dispatcher are typed against this.
// ---------------------------------------------------------------------------

export type BridgeMethodMap = {
  'context.get': { args: []; result: HostContext }
  'types.get': { args: [{ typeId: string }]; result: BridgeType }
  /** List types the user can see (for pickers). Optionally scoped to a single space. */
  'types.list': { args: [{ spaceId?: string }]; result: BridgeTypeRef[] }
  'objects.create': {
    args: [
      {
        typeId: string
        attributes: BridgeAttributeInput[]
        /** Workflow moves made by this write: attributeId -> transitionId. */
        transitions?: Record<string, string>
      },
    ]
    result: BridgeObject
  }
  'objects.get': { args: [{ id: string }]; result: BridgeObject }
  'objects.update': {
    args: [
      {
        id: string
        attributes: BridgeAttributeInput[]
        /**
         * Workflow moves made by this write: attributeId -> transitionId. The new state id goes in
         * `attributes` as that attribute's value, and the transition here says which move it was —
         * both travel in the one payload, so the change is applied and validated together.
         */
        transitions?: Record<string, string>
      },
    ]
    result: BridgeObject
  }
  'objects.remove': { args: [{ id: string }]; result: { id: string } }
  'objects.query': {
    args: [{ starql: string; typeId?: string; offset?: number; limit?: number }]
    result: BridgeQueryResult
  }
  /** The external systems this app declares, and whether an admin has connected each one. */
  'objects.aggregate': {
    args: [
      {
        typeId: string
        where?: string
        operation: BridgeAggregateOperation
        /** Resolved attributeId, not the manifest key: the host receives ids. */
        attributeId?: string
        groupByAttributeId?: string
      },
    ]
    result: BridgeAggregateResult
  }
  'remote.list': { args: []; result: BridgeRemote[] }
  /**
   * Call one of them. The app names a remote its manifest declared and a path within it — never an
   * address — and Starhive makes the call, adding the credential the workspace supplied. The app
   * never holds that credential and cannot reach a system it did not declare.
   */
  'remote.fetch': {
    args: [
      {
        remote: string
        path: string
        method?: string
        headers?: Record<string, string>
        body?: string
        /** See {@link BridgeFetchInit.cacheSeconds}. */
        cacheSeconds?: number
      },
    ]
    result: BridgeFetchResult
  }
  /** The moves an object can make right now on one of its `WORKFLOW` attributes. */
  'workflow.transitions': {
    args: [{ objectId: string; attributeId: string }]
    result: BridgeTransitionsResult
  }
  'config.get': { args: []; result: { config: Record<string, unknown> } }
  'config.set': {
    args: [{ config: Record<string, unknown> }]
    result: { config: Record<string, unknown> }
  }
  /**
   * Save this block's state onto the document node it is mounted in.
   *
   * Only the `macro` slot may call it: every other slot is a frame in a pane, with no node to write
   * to. The host stores what it is given as JSON on the node and pushes it back as
   * {@link HostContext.macroState}, so a later mount of the same block reads it again.
   *
   * The state lives in the page, which means it is copied when the page is copied, restored when an
   * old version of the page is restored, and carried in every fetch of that page — so keep it to what
   * the block genuinely cannot recompute, and expect the host to refuse one that is too large.
   */
  'macro.setState': {
    args: [{ state: Record<string, unknown> }]
    result: { state: Record<string, unknown> }
  }
  'toast.show': { args: [{ message: string; variant?: ToastVariant }]; result: null }
  navigate: { args: [{ to: string }]; result: null }
  /**
   * Ask the host to give this iframe `height` px. Only the `macro` slot honours it — everywhere else
   * the frame is sized by its container, and the call is a no-op rather than an error so an app can
   * report its height unconditionally.
   */
  'frame.resize': { args: [{ height: number }]; result: null }
}

export type BridgeMethod = keyof BridgeMethodMap
export type BridgeArgs<M extends BridgeMethod> = BridgeMethodMap[M]['args']
export type BridgeResult<M extends BridgeMethod> = BridgeMethodMap[M]['result']

export const BRIDGE_METHODS = [
  'context.get',
  'types.get',
  'types.list',
  'objects.create',
  'objects.get',
  'objects.update',
  'objects.remove',
  'objects.query',
  'objects.aggregate',
  'workflow.transitions',
  'remote.list',
  'remote.fetch',
  'config.get',
  'config.set',
  'toast.show',
  'navigate',
  'frame.resize',
  'macro.setState',
] as const satisfies readonly BridgeMethod[]

// ---------------------------------------------------------------------------
// Wire envelopes.
// ---------------------------------------------------------------------------

/** App -> host, over the port. Shape fixed by spec. */
export type BridgeRequest = {
  id: string
  type: 'invoke'
  method: BridgeMethod
  args: unknown[]
}

/** Host -> app, over the port. Shape fixed by spec. */
export type BridgeResponse = { id: string } & (
  { ok: true; result: unknown } | { ok: false; error: BridgeError }
)

/** Host -> app, over the port: unsolicited context/theme update (no id). */
export type BridgeContextPush = { type: 'context'; context: HostContext }

// Handshake envelopes (sent over `window.postMessage`, not the port).
export const READY_CHANNEL = 'starhive-bridge:ready'
export const INIT_CHANNEL = 'starhive-bridge:init'

export type ReadyMessage = {
  channel: typeof READY_CHANNEL
  protocolVersion: number
  nonce: string
}

export type InitMessage = {
  channel: typeof INIT_CHANNEL
  protocolVersion: number
  nonce: string
  context: HostContext
}

// ---------------------------------------------------------------------------
// Pure lookup helpers. Framework-free, so the host and the SDK share them.
//
// These exist because every app was hand-rolling them, and doing it by display
// name — which an admin can change underneath the app. Address an attribute by
// its manifest key.
// ---------------------------------------------------------------------------

/** The attribute with this manifest key (`"status"`), or undefined if the type has none. */
export function attributeByKey(type: BridgeType, key: string): BridgeAttribute | undefined {
  return type.attributes.find((attribute) => attribute.key === key)
}

/**
 * The attribute with this display name.
 *
 * A fallback for native attributes an app did not provision (those have no key). For the app's own
 * attributes prefer {@link attributeByKey} — a name is not identity.
 */
export function attributeByName(type: BridgeType, name: string): BridgeAttribute | undefined {
  return type.attributes.find((attribute) => attribute.name === name)
}

/**
 * The logical type key a provisioned typeId belongs to, or undefined if it is not one of this app's.
 *
 * The reverse of {@link HostContext.typeKeyToId}. Needed because an object carries a `typeId` while
 * every type-facing bridge call takes a *key* — and because an id that is not in the map is an object
 * outside this app's scope, which the host will refuse anyway.
 */
export function typeKeyOf(context: HostContext, typeId: string): string | undefined {
  return Object.keys(context.typeKeyToId).find((key) => context.typeKeyToId[key] === typeId)
}

/** The attribute matched by manifest key, falling back to display name. */
export function attributeBy(type: BridgeType, keyOrName: string): BridgeAttribute | undefined {
  return attributeByKey(type, keyOrName) ?? attributeByName(type, keyOrName)
}

/** This attribute's values on the object — empty when it has none. */
export function valuesOf(object: BridgeObject, attributeId: string): BridgeAttributeValue[] {
  return object.attributes.find((attribute) => attribute.attributeId === attributeId)?.values ?? []
}

/**
 * Best human text for an attribute's first value: the host's resolved {@link
 * BridgeAttributeValue.display} when it has one, else the raw string. Undefined when there is no
 * value at all — which a caller should render as "no value", not as an empty string.
 */
export function displayOf(object: BridgeObject, attributeId: string): string | undefined {
  const [first] = valuesOf(object, attributeId)
  if (!first) return undefined
  return first.display ?? first.value
}

/** The raw string of an attribute's first value, unformatted — for parsing, not for showing. */
export function rawValueOf(object: BridgeObject, attributeId: string): string | undefined {
  return valuesOf(object, attributeId)[0]?.value
}

// ---------------------------------------------------------------------------
// Runtime guards — never trust a `MessageEvent.data` shape.
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function isReadyMessage(data: unknown): data is ReadyMessage {
  return (
    isRecord(data) &&
    data.channel === READY_CHANNEL &&
    typeof data.nonce === 'string' &&
    typeof data.protocolVersion === 'number'
  )
}

export function isInitMessage(data: unknown): data is InitMessage {
  return (
    isRecord(data) &&
    data.channel === INIT_CHANNEL &&
    typeof data.nonce === 'string' &&
    typeof data.protocolVersion === 'number' &&
    isRecord(data.context)
  )
}

/**
 * Every method in {@link BridgeMethodMap} must also be in {@link BRIDGE_METHODS}.
 *
 * The list is the runtime allowlist `isBridgeRequest` checks, and the two are separate because types
 * do not survive to runtime. `satisfies` only proves that everything *in* the list is a real method —
 * it says nothing about a method that was added to the map and forgotten here. A method in that state
 * type-checks everywhere, and then the host drops its requests on the floor without a response: no
 * error, no log, just a call that never comes back. This turns that into a compile error.
 */
type MethodsMissingFromAllowlist = Exclude<BridgeMethod, (typeof BRIDGE_METHODS)[number]>
const _everyMethodIsAllowed: MethodsMissingFromAllowlist extends never ? true : never = true
void _everyMethodIsAllowed

export function isBridgeRequest(data: unknown): data is BridgeRequest {
  return (
    isRecord(data) &&
    data.type === 'invoke' &&
    typeof data.id === 'string' &&
    typeof data.method === 'string' &&
    (BRIDGE_METHODS as readonly string[]).includes(data.method) &&
    Array.isArray(data.args)
  )
}

export function isBridgeResponse(data: unknown): data is BridgeResponse {
  if (!isRecord(data) || typeof data.id !== 'string') return false
  if (data.ok === true) return 'result' in data
  if (data.ok === false) {
    return (
      isRecord(data.error) &&
      typeof data.error.code === 'string' &&
      typeof data.error.message === 'string'
    )
  }
  return false
}

export function isContextPush(data: unknown): data is BridgeContextPush {
  return isRecord(data) && data.type === 'context' && isRecord(data.context)
}
