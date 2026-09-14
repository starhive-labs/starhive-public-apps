import {
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { createBridge, type StarhiveBridge, type WriteOptions } from './bridge'
import { attributeBy, typeKeyOf } from './protocol'
import type {
  BridgeAggregateRequest,
  BridgeAggregateResult,
  BridgeAttribute,
  BridgeAttributeInput,
  BridgeObject,
  BridgeQueryResult,
  BridgeTransitionsResult,
  BridgeType,
  BridgeTypeRef,
  HostContext,
  StarhiveTheme,
  ToastVariant,
} from './protocol'

// A lazily-created singleton so an app can just call hooks without wiring a
// provider. Tests (and advanced hosts) can inject a bridge via <StarhiveProvider>.
let singleton: StarhiveBridge | null = null
function getSingletonBridge(): StarhiveBridge {
  if (!singleton) singleton = createBridge()
  return singleton
}

const BridgeReactContext = createContext<StarhiveBridge | null>(null)

export function StarhiveProvider({
  bridge,
  children,
}: {
  /** Override the bridge instance (e.g. a mock in tests). Defaults to the singleton. */
  bridge?: StarhiveBridge
  children: ReactNode
}) {
  const value = useMemo(() => bridge ?? getSingletonBridge(), [bridge])
  return <BridgeReactContext.Provider value={value}>{children}</BridgeReactContext.Provider>
}

/** Access the active bridge instance imperatively. */
export function useBridge(): StarhiveBridge {
  return useContext(BridgeReactContext) ?? getSingletonBridge()
}

/**
 * Returns the live host context. Suspends (throws `bridge.ready`) until the
 * handshake completes, so callers can destructure the result unconditionally.
 * Re-renders when the host pushes a context/theme update.
 */
export function useStarhiveContext(): HostContext {
  const bridge = useBridge()
  const [context, setContext] = useState<HostContext | null>(() =>
    bridge.isReady() ? bridge.getContext() : null,
  )

  useEffect(() => {
    let active = true
    if (bridge.isReady()) setContext(bridge.getContext())
    else bridge.ready.then((c) => active && setContext(c)).catch(() => undefined)
    const unsubscribe = bridge.onContextChange((c) => active && setContext(c))
    return () => {
      active = false
      unsubscribe()
    }
  }, [bridge])

  if (!context) throw bridge.ready
  return context
}

export function useTheme(): StarhiveTheme {
  return useStarhiveContext().theme
}

export type UseObjectQueryResult = {
  data: BridgeQueryResult | undefined
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

/**
 * Runs a StarQL query and re-runs whenever the query string or options change.
 */
export function useObjectQuery(
  starql: string,
  options?: { typeKey?: string; typeId?: string; offset?: number; limit?: number },
): UseObjectQueryResult {
  const bridge = useBridge()
  const typeKey = options?.typeKey
  const typeId = options?.typeId
  const offset = options?.offset
  const limit = options?.limit

  const [state, setState] = useState<{
    data: BridgeQueryResult | undefined
    isLoading: boolean
    error: Error | null
  }>({ data: undefined, isLoading: true, error: null })
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let active = true
    setState((prev) => ({ ...prev, isLoading: true, error: null }))
    bridge.objects.query(starql, { typeKey, typeId, offset, limit }).then(
      (data) => active && setState({ data, isLoading: false, error: null }),
      (error: Error) => active && setState({ data: undefined, isLoading: false, error }),
    )
    return () => {
      active = false
    }
  }, [bridge, starql, typeKey, typeId, offset, limit, reloadToken])

  const refetch = useCallback(() => setReloadToken((t) => t + 1), [])
  return { ...state, refetch }
}

export type UseAggregateResult = {
  data: BridgeAggregateResult | undefined
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

/**
 * A number about the app's objects, computed by the index.
 *
 * ```tsx
 * const { data } = useObjectAggregate({
 *   typeKey: 'codeLink',
 *   where: '"Kind" = "merge-request"',
 *   operation: 'count',
 *   groupBy: 'state',
 * })
 * // data?.groups → { opened: 4, merged: 11 }
 * ```
 *
 * Prefer this over counting a query's rows: a query answers "how many" with `total`, but a breakdown
 * meant fetching every row and tallying it in the browser — bounded by the page size, and quietly
 * wrong past it.
 */
export function useObjectAggregate(request: BridgeAggregateRequest): UseAggregateResult {
  const bridge = useBridge()
  const [state, setState] = useState<{
    data: BridgeAggregateResult | undefined
    isLoading: boolean
    error: Error | null
  }>({ data: undefined, isLoading: true, error: null })
  const [reloadToken, setReloadToken] = useState(0)

  // Callers pass an inline object, so depend on what it says rather than on its identity.
  const fingerprint = JSON.stringify(request)

  useEffect(() => {
    let active = true
    setState((prev) => ({ ...prev, isLoading: true, error: null }))
    bridge.objects.aggregate(JSON.parse(fingerprint) as BridgeAggregateRequest).then(
      (data) => active && setState({ data, isLoading: false, error: null }),
      (error: Error) => active && setState({ data: undefined, isLoading: false, error }),
    )
    return () => {
      active = false
    }
  }, [bridge, fingerprint, reloadToken])

  const refetch = useCallback(() => setReloadToken((t) => t + 1), [])
  return { ...state, refetch }
}

export type UseObjects = {
  create: (
    typeKey: string,
    attributes: BridgeAttributeInput[],
    options?: WriteOptions,
  ) => Promise<BridgeObject>
  get: (id: string) => Promise<BridgeObject>
  update: (
    id: string,
    attributes: BridgeAttributeInput[],
    options?: WriteOptions,
  ) => Promise<BridgeObject>
  remove: (id: string) => Promise<{ id: string }>
}

/** Stable imperative object CRUD bound to the active bridge. */
export function useObjects(): UseObjects {
  const bridge = useBridge()
  return useMemo<UseObjects>(
    () => ({
      create: (typeKey, attributes, options) => bridge.objects.create(typeKey, attributes, options),
      get: (id) => bridge.objects.get(id),
      update: (id, attributes, options) => bridge.objects.update(id, attributes, options),
      remove: (id) => bridge.objects.remove(id),
    }),
    [bridge],
  )
}

export type UseTransitionsResult = {
  data: BridgeTransitionsResult | undefined
  isLoading: boolean
  error: Error | null
  /** Re-ask. A successful move changes the answer, so call this after every transition. */
  refetch: () => void
}

/**
 * The moves an object can make right now on one of its `WORKFLOW` attributes — what to draw the
 * buttons from.
 *
 * ```tsx
 * const { data, refetch } = useTransitions(objectId, statusAttributeId)
 * const objects = useObjects()
 *
 * return data?.transitions.map((t) => (
 *   <button
 *     key={t.id}
 *     onClick={async () => {
 *       await objects.update(objectId, [{ attributeId: statusAttributeId, values: [t.toStateId] }], {
 *         transitions: { [statusAttributeId]: t.id },
 *       })
 *       refetch()
 *     }}
 *   >
 *     {t.name}
 *   </button>
 * ))
 * ```
 */
export function useTransitions(objectId: string, attributeId: string): UseTransitionsResult {
  const bridge = useBridge()
  const [state, setState] = useState<{
    data: BridgeTransitionsResult | undefined
    isLoading: boolean
    error: Error | null
  }>({ data: undefined, isLoading: true, error: null })
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let active = true
    setState((prev) => ({ ...prev, isLoading: true, error: null }))
    bridge.workflow.transitions(objectId, attributeId).then(
      (data) => active && setState({ data, isLoading: false, error: null }),
      (error: Error) => active && setState({ data: undefined, isLoading: false, error }),
    )
    return () => {
      active = false
    }
  }, [bridge, objectId, attributeId, reloadToken])

  const refetch = useCallback(() => setReloadToken((t) => t + 1), [])
  return { ...state, refetch }
}

export type UseConfigResult = {
  config: Record<string, unknown> | undefined
  isLoading: boolean
  /** Persist config. Only valid on the `settingsPage` slot (rejects otherwise). */
  setConfig: (config: Record<string, unknown>) => Promise<Record<string, unknown>>
}

export function useConfig(): UseConfigResult {
  const bridge = useBridge()
  const [config, setConfigState] = useState<Record<string, unknown> | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true
    bridge.config.get().then(
      (c) => {
        if (!active) return
        setConfigState(c)
        setIsLoading(false)
      },
      () => active && setIsLoading(false),
    )
    return () => {
      active = false
    }
  }, [bridge])

  const setConfig = useCallback(
    async (next: Record<string, unknown>) => {
      const saved = await bridge.config.set(next)
      setConfigState(saved)
      return saved
    },
    [bridge],
  )

  return { config, isLoading, setConfig }
}

export type UseMacroStateResult = {
  /** What this block last saved, or `undefined` for a block that never has. */
  state: Record<string, unknown> | undefined
  /** True while a save is in flight. */
  isSaving: boolean
  /**
   * Whether saving is possible at all right now — false on a page being read rather than edited.
   *
   * Check it before offering anything that writes. Saving anyway is not dangerous, it is just
   * refused; the cost is a reader who edits a diagram and only then learns it cannot be kept.
   */
  canSave: boolean
  /** Save this block's state onto its document node. Only valid on the `macro` slot. */
  setState: (state: Record<string, unknown>) => Promise<Record<string, unknown>>
}

/**
 * The state this macro block remembers, and the way to change it.
 *
 * A macro has nowhere of its own to keep anything: it is one block among many of the same module, so
 * an install-wide setting cannot tell them apart, and it has no object unless the app provisions a
 * type. This is that missing place — a small JSON value stored on the document node the block sits
 * in, which comes back as `context.macroState` the next time the block mounts.
 *
 * It reads from the context rather than fetching, because the host already pushed it with the
 * handshake; a save updates the same context, so the value here follows the host rather than
 * competing with it.
 *
 * ```tsx
 * const { state, setState } = useMacroState()
 * await setState({ scene, svg })
 * ```
 */
export function useMacroState(): UseMacroStateResult {
  const bridge = useBridge()
  const { macroState, macroStateWritable } = useStarhiveContext()
  const [isSaving, setIsSaving] = useState(false)

  const setState = useCallback(
    async (next: Record<string, unknown>) => {
      setIsSaving(true)
      try {
        // The host pushes the saved value back as context, which is what re-renders this hook's
        // `state` — so nothing is mirrored locally and the two cannot disagree.
        return await bridge.macro.setState(next)
      } finally {
        setIsSaving(false)
      }
    },
    [bridge],
  )

  return {
    state: macroState,
    isSaving,
    // Only an explicit `false` forbids it: a host that never sends the field is an older one, and it
    // will answer a save honestly rather than leaving the app to guess.
    canSave: macroStateWritable !== false,
    setState,
  }
}

export function useToast(): (message: string, variant?: ToastVariant) => Promise<void> {
  const bridge = useBridge()
  return useCallback((message, variant) => bridge.toast(message, variant), [bridge])
}

export function useNavigate(): (to: string) => Promise<void> {
  const bridge = useBridge()
  return useCallback((to) => bridge.navigate(to), [bridge])
}

/**
 * Keeps a `macro` block as tall as what the app drew in it.
 *
 * A macro lives in someone's document, so the host cannot know how tall it should be — only the app
 * can say. Put the returned ref on the element that wraps your content and its height is reported to
 * the host on every change:
 *
 * ```tsx
 * const ref = useAutoResize<HTMLDivElement>()
 * return <div ref={ref}>…</div>
 * ```
 *
 * Harmless in every other slot: the host ignores the request there.
 */
export function useAutoResize<T extends HTMLElement = HTMLElement>(): RefObject<T | null> {
  const bridge = useBridge()
  const ref = useRef<T>(null)

  useEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === 'undefined') return

    // Only changes are sent: a ResizeObserver fires on sub-pixel reflows too, and a message per
    // repaint would be a message per repaint for as long as the page is open.
    let reported = -1
    const report = () => {
      const height = Math.ceil(element.getBoundingClientRect().height)
      if (height <= 0 || height === reported) return
      reported = height
      // The host may not have finished the handshake yet, and a macro that fails to resize is still
      // a macro that renders — at its manifest height.
      void bridge.resize(height).catch(() => undefined)
    }

    report()
    const observer = new ResizeObserver(report)
    observer.observe(element)
    return () => observer.disconnect()
  }, [bridge])

  return ref
}

export type UseTypeResult = {
  data: BridgeType | undefined
  isLoading: boolean
  error: Error | null
}

/**
 * Reads a provisioned type's schema so the app can resolve attributeIds by name.
 *
 * An empty key asks nothing and reports nothing, the way `useObject(undefined)` does — callers that
 * only sometimes have a key (see {@link useTypeById}) would otherwise send a request that can only
 * be refused, once per render of every panel.
 */
export function useType(typeKey: string): UseTypeResult {
  const bridge = useBridge()
  const [state, setState] = useState<UseTypeResult>({
    data: undefined,
    isLoading: Boolean(typeKey),
    error: null,
  })

  useEffect(() => {
    if (!typeKey) {
      setState({ data: undefined, isLoading: false, error: null })
      return
    }
    let active = true
    setState({ data: undefined, isLoading: true, error: null })
    bridge.getType(typeKey).then(
      (data) => active && setState({ data, isLoading: false, error: null }),
      (error: Error) => active && setState({ data: undefined, isLoading: false, error }),
    )
    return () => {
      active = false
    }
  }, [bridge, typeKey])

  return state
}

export type UseObjectResult = {
  data: BridgeObject | undefined
  isLoading: boolean
  error: Error | null
  /** Re-read. Call after a write that this component did not make. */
  refetch: () => void
}

/**
 * One object by id.
 *
 * Only the app's **own** objects: the host refuses an object outside the app's provisioned types and
 * space, so this is not a way to read the object an `objectPanel` is mounted beside. That object's id
 * is useful as a filter value in a query, not as something to fetch.
 */
export function useObject(objectId: string | undefined): UseObjectResult {
  const bridge = useBridge()
  const [state, setState] = useState<{
    data: BridgeObject | undefined
    isLoading: boolean
    error: Error | null
  }>({ data: undefined, isLoading: Boolean(objectId), error: null })
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!objectId) {
      setState({ data: undefined, isLoading: false, error: null })
      return
    }
    let active = true
    setState((prev) => ({ ...prev, isLoading: true, error: null }))
    bridge.objects.get(objectId).then(
      (data) => active && setState({ data, isLoading: false, error: null }),
      (error: Error) => active && setState({ data: undefined, isLoading: false, error }),
    )
    return () => {
      active = false
    }
  }, [bridge, objectId, reloadToken])

  const refetch = useCallback(() => setReloadToken((t) => t + 1), [])
  return { ...state, refetch }
}

export type UseAttributeResult = {
  data: BridgeAttribute | undefined
  isLoading: boolean
  error: Error | null
}

/**
 * One attribute of a provisioned type, by manifest key (falling back to display name).
 *
 * Replaces the `attributeId(type, 'Due date')`-by-name helper every app was writing: a display name
 * is not identity, so an admin renaming the attribute used to break the app.
 *
 * ```tsx
 * const { data: status } = useAttribute('onboardingTask', 'status')
 * ```
 */
export function useAttribute(typeKey: string, attributeKeyOrName: string): UseAttributeResult {
  const { data: type, isLoading, error } = useType(typeKey)
  const data = useMemo(
    () => (type ? attributeBy(type, attributeKeyOrName) : undefined),
    [type, attributeKeyOrName],
  )
  return { data, isLoading, error }
}

export type UseAttributesResult = {
  /** The attributes that matched, in the order asked for. Ones the type does not have are skipped. */
  data: BridgeAttribute[]
  isLoading: boolean
  error: Error | null
  /** Keys asked for that the type has no attribute for — a manifest/schema mismatch worth surfacing. */
  missing: string[]
}

/**
 * Several attributes of a provisioned type at once, in the order given — the natural input for a
 * table's columns or a form's fields.
 *
 * ```tsx
 * const { data: columns } = useAttributes('onboardingTask', ['title', 'status', 'dueDate'])
 * ```
 */
export function useAttributes(
  typeKey: string,
  attributeKeysOrNames: string[],
): UseAttributesResult {
  const { data: type, isLoading, error } = useType(typeKey)
  // Callers pass an inline array literal, so depend on the contents rather than the identity.
  const wanted = attributeKeysOrNames.join(' ')

  return useMemo(() => {
    const keys = wanted ? wanted.split(' ') : []
    const resolved = keys.map((key) => (type ? attributeBy(type, key) : undefined))
    return {
      data: resolved.filter((attribute): attribute is BridgeAttribute => Boolean(attribute)),
      isLoading,
      error,
      missing: type ? keys.filter((_, index) => !resolved[index]) : [],
    }
  }, [type, wanted, isLoading, error])
}

/**
 * The schema of a type, found by its **id** rather than its manifest key — what a caller holding a
 * {@link BridgeObject} has.
 *
 * A type this app provisioned is served from {@link useType} and its manifest key. Anything else is
 * asked for by id and the **host decides**, which is the only place the decision can be made
 * correctly: an app may read the types its config-bound references point at *and their subtypes*,
 * and nothing in the handshake describes the type hierarchy. Matching `referenceTargets` here
 * instead — which this hook used to do — refused a subtype without ever asking, so an app could read
 * an object and then be told by its own SDK that the object's type was none of its business.
 *
 * The cost of asking is one refused round trip for a type genuinely out of scope, and the refusal
 * arrives as `error` either way.
 */
export function useTypeById(typeId: string | undefined): UseTypeResult {
  const context = useStarhiveContext()
  const bridge = useBridge()
  const typeKey = typeId ? typeKeyOf(context, typeId) : undefined

  const byKey = useType(typeKey ?? '')
  // Carries the id it answers for: an effect runs after the render that changed `typeId`, so state
  // from the previous id would otherwise be reported for the new one — an answer about the wrong
  // type, or a stale error, in the render between the two.
  const [byId, setById] = useState<UseTypeResult & { forId?: string }>({
    data: undefined,
    isLoading: false,
    error: null,
  })

  useEffect(() => {
    if (!typeId || typeKey) return
    let active = true
    bridge.invoke('types.get', { typeId }).then(
      (data) => active && setById({ data, isLoading: false, error: null, forId: typeId }),
      (error: Error) =>
        active && setById({ data: undefined, isLoading: false, error, forId: typeId }),
    )
    return () => {
      active = false
    }
  }, [bridge, typeId, typeKey])

  if (!typeId) return { data: undefined, isLoading: false, error: null }
  if (typeKey) return byKey
  if (byId.forId !== typeId) return { data: undefined, isLoading: true, error: null }
  return byId
}

export type UseTypesResult = {
  data: BridgeTypeRef[]
  isLoading: boolean
  error: Error | null
}

/** Lists the types the user can see (optionally scoped to one space) — for config/reference pickers. */
export function useTypes(options?: { spaceId?: string }): UseTypesResult {
  const bridge = useBridge()
  const spaceId = options?.spaceId
  const [state, setState] = useState<UseTypesResult>({ data: [], isLoading: true, error: null })

  useEffect(() => {
    let active = true
    setState({ data: [], isLoading: true, error: null })
    bridge.listTypes({ spaceId }).then(
      (data) => active && setState({ data, isLoading: false, error: null }),
      (error: Error) => active && setState({ data: [], isLoading: false, error }),
    )
    return () => {
      active = false
    }
  }, [bridge, spaceId])

  return state
}
