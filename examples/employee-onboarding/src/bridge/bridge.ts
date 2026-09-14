import { createId } from './ids'
import {
  BRIDGE_PROTOCOL_VERSION,
  type BridgeArgs,
  type BridgeAttributeInput,
  BridgeErrorCode,
  type BridgeMethod,
  type BridgeObject,
  type BridgeAggregateRequest,
  type BridgeAggregateResult,
  type BridgeQueryResult,
  type BridgeRequest,
  type BridgeFetchInit,
  type BridgeRemote,
  type BridgeResult,
  type BridgeTransitionsResult,
  type BridgeType,
  type BridgeTypeRef,
  type HostContext,
  isContextPush,
  isInitMessage,
  isBridgeResponse,
  type ReadyMessage,
  READY_CHANNEL,
  type StarhiveTheme,
  type ToastVariant,
} from './protocol'

/** Error thrown when a bridge call fails. Carries the protocol error `code`. */
export class StarhiveBridgeError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'StarhiveBridgeError'
    this.code = code
  }
}

/**
 * Extras carried by a write.
 *
 * A `WORKFLOW` value cannot simply be written: Starhive refuses a new state that does not name the
 * transition that got there. Put the target state in `attributes` as usual and name the move here —
 * one payload, applied and validated together:
 *
 * ```ts
 * const { transitions } = await bridge.workflow.transitions(objectId, statusAttributeId)
 * const done = transitions.find((t) => t.name === 'Complete')!
 * await bridge.objects.update(
 *   objectId,
 *   [{ attributeId: statusAttributeId, values: [done.toStateId] }],
 *   { transitions: { [statusAttributeId]: done.id } },
 * )
 * ```
 */
/**
 * An external system's answer.
 *
 * Shaped after `Response` where it helps — [ok], [status], [json] — but it is a plain value that has
 * already crossed the bridge, not a live stream: the body is here, and reading it twice is free.
 */
export type BridgeFetchResponse = {
  status: number
  /** True for 2xx, exactly as `Response.ok`. */
  ok: boolean
  headers: Record<string, string>
  /** The body as text, or null when there was none. */
  body: string | null
  /** The body parsed as JSON. Throws the way `JSON.parse` throws if it isn't. */
  json<T = unknown>(): T
}

export type WriteOptions = {
  /** attributeId -> transitionId, for the `WORKFLOW` attributes this write moves. */
  transitions?: Record<string, string>
}

export type CreateBridgeOptions = {
  /** Window to post the `ready` handshake to. Defaults to `window.parent`. */
  targetWindow?: Window
  /** Window to receive the `init` handshake on. Defaults to `window`. */
  self?: Window
  /** targetOrigin for the `ready` post. Defaults to '*' — the app usually does
   * not know the host origin, and the host validates the app's origin instead. */
  targetOrigin?: string
  /** Per-request timeout in ms. Defaults to 15000. */
  timeoutMs?: number
}

export type StarhiveBridge = {
  /** Resolves with the initial {@link HostContext} once the handshake completes. */
  readonly ready: Promise<HostContext>
  isReady(): boolean
  /** Latest context. Throws if the handshake has not completed yet. */
  getContext(): HostContext
  getTheme(): StarhiveTheme
  /** Subscribe to context/theme updates. Returns an unsubscribe fn. */
  onContextChange(listener: (context: HostContext) => void): () => void
  /** Low-level typed invoke; prefer the namespaced helpers below. */
  invoke<M extends BridgeMethod>(method: M, ...args: BridgeArgs<M>): Promise<BridgeResult<M>>
  /** Resolve a logical type key to its provisioned Starhive typeId. */
  resolveTypeKey(typeKey: string): string
  /**
   * Resolve a manifest attribute key to its provisioned Starhive attributeId.
   *
   * Takes either `"typeKey.attributeKey"` or, with [typeKey] given, the bare attribute key. This is
   * the stable way to name an attribute — matching on display name breaks when an admin renames it.
   *
   * ```ts
   * const status = starhive.resolveAttributeKey('onboardingTask.status')
   * const due    = starhive.resolveAttributeKey('dueDate', 'onboardingTask')
   * ```
   */
  resolveAttributeKey(attributeKey: string, typeKey?: string): string
  getType(typeKey: string): Promise<BridgeType>
  /** List types the user can see (optionally scoped to one space) — for config/reference pickers. */
  listTypes(options?: { spaceId?: string }): Promise<BridgeTypeRef[]>
  objects: {
    create(
      typeKey: string,
      attributes: BridgeAttributeInput[],
      options?: WriteOptions,
    ): Promise<BridgeObject>
    get(id: string): Promise<BridgeObject>
    update(
      id: string,
      attributes: BridgeAttributeInput[],
      options?: WriteOptions,
    ): Promise<BridgeObject>
    remove(id: string): Promise<{ id: string }>
    query(
      starql: string,
      options?: {
        typeKey?: string
        /**
         * A type addressed by id rather than by manifest key — for a type an admin pointed one of
         * this app's references at, which has no key because the app did not declare it.
         *
         * Takes precedence over [typeKey] when both are given.
         */
        typeId?: string
        offset?: number
        limit?: number
      },
    ): Promise<BridgeQueryResult>
    /**
     * A number about many objects, without fetching them.
     *
     * `objects.query` hands back rows and a `total`, which answers "how many" and nothing else — a
     * breakdown meant fetching every row and tallying it in the browser, bounded by the page size and
     * wrong past it. This asks the index the question instead.
     *
     * ```ts
     * const open = await starhive.objects.aggregate({
     *   typeKey: 'codeLink',
     *   where: '"Kind" = "merge-request"',
     *   operation: 'count',
     *   groupBy: 'state',
     * })
     * // { groups: { opened: 4, merged: 11, closed: 2 }, total: 17 }
     * ```
     */
    aggregate(request: BridgeAggregateRequest): Promise<BridgeAggregateResult>
  }
  workflow: {
    /** The moves this object can make right now on its `WORKFLOW` attribute [attributeId]. */
    transitions(objectId: string, attributeId: string): Promise<BridgeTransitionsResult>
  }
  /** The external systems this app declared, and whether an admin has connected each one. */
  remotes(): Promise<BridgeRemote[]>
  /**
   * Call one of those systems.
   *
   * You name a remote your manifest declared and a path within it; Starhive makes the call and adds
   * the credential the workspace supplied, which your app never sees. A remote you did not declare,
   * a path that would leave the declared address, and an address inside Starhive's own network are
   * all refused before anything is sent.
   *
   * ```ts
   * const res = await bridge.fetch('zendesk', '/tickets?status=open')
   * if (res.ok) setTickets(res.json<TicketPage>().results)
   * ```
   *
   * A non-2xx from the far end comes back as a value with that status — it is an answer, not an
   * error. The promise rejects only when the call could not be made at all.
   */
  fetch(remote: string, path: string, init?: BridgeFetchInit): Promise<BridgeFetchResponse>
  config: {
    get(): Promise<Record<string, unknown>>
    set(config: Record<string, unknown>): Promise<Record<string, unknown>>
  }
  macro: {
    /**
     * Save this block's state onto the document node it is mounted in, and resolve with what the
     * host stored.
     *
     * Only valid in the `macro` slot; anywhere else there is no node to write to and this rejects
     * before a message is sent. What is written comes back as `context.macroState` on the next
     * mount of the same block — see {@link HostContext.macroState} for what belongs in it.
     */
    setState(state: Record<string, unknown>): Promise<Record<string, unknown>>
  }
  toast(message: string, variant?: ToastVariant): Promise<void>
  navigate(to: string): Promise<void>
  /**
   * Ask the host for `height` px of vertical room. Only the `macro` slot resizes; elsewhere the host
   * ignores it, so an app that always reports its height renders correctly in every slot.
   */
  resize(height: number): Promise<void>
  /** Tear down listeners and reject all in-flight requests. */
  destroy(): void
}

type Pending = {
  resolve: (value: unknown) => void
  reject: (reason: StarhiveBridgeError) => void
  timer: ReturnType<typeof setTimeout>
}

/**
 * Creates the bridge inside an app iframe. Immediately kicks off the handshake:
 * posts `ready` to the parent and waits for the host's `init` (which transfers
 * the MessagePort and the initial context). All subsequent traffic uses the port.
 */
export function createBridge(options: CreateBridgeOptions = {}): StarhiveBridge {
  const selfWindow = options.self ?? window
  const targetWindow = options.targetWindow ?? window.parent
  const targetOrigin = options.targetOrigin ?? '*'
  const timeoutMs = options.timeoutMs ?? 15_000
  const nonce = createId()

  let port: MessagePort | null = null
  let context: HostContext | null = null
  let destroyed = false
  const pending = new Map<string, Pending>()
  const contextListeners = new Set<(context: HostContext) => void>()

  let resolveReady!: (context: HostContext) => void
  let rejectReady!: (reason: Error) => void
  const ready = new Promise<HostContext>((resolve, reject) => {
    resolveReady = resolve
    rejectReady = reject
  })

  function handlePortMessage(event: MessageEvent): void {
    const { data } = event
    if (isContextPush(data)) {
      context = data.context
      contextListeners.forEach((listener) => listener(data.context))
      return
    }
    if (!isBridgeResponse(data)) return
    const entry = pending.get(data.id)
    if (!entry) return
    pending.delete(data.id)
    clearTimeout(entry.timer)
    if (data.ok) {
      entry.resolve(data.result)
    } else {
      entry.reject(new StarhiveBridgeError(data.error.code, data.error.message))
    }
  }

  const readyMessage: ReadyMessage = {
    channel: READY_CHANNEL,
    protocolVersion: BRIDGE_PROTOCOL_VERSION,
    nonce,
  }

  // Re-announce `ready` a few times: the host's listener may attach slightly
  // after the iframe loads (e.g. a React StrictMode remount), so a single post
  // can be missed. Stops as soon as `init` arrives or the bridge is destroyed.
  let readyAttempts = 0
  const READY_MAX_ATTEMPTS = 15
  const READY_RETRY_MS = 200
  let readyTimer: ReturnType<typeof setInterval> | null = null
  function stopReadyRetry(): void {
    if (readyTimer !== null) {
      clearInterval(readyTimer)
      readyTimer = null
    }
  }

  function handleInit(event: MessageEvent): void {
    if (port) return // already initialised; ignore duplicates (StrictMode/double-init)
    if (!isInitMessage(event.data)) return
    // The echoed nonce proves this init answers OUR ready, not an attacker's.
    if (event.data.nonce !== nonce) return
    const transferred = event.ports[0]
    if (!transferred) return

    port = transferred
    port.onmessage = handlePortMessage
    port.start?.()
    context = event.data.context
    stopReadyRetry()
    selfWindow.removeEventListener('message', handleInit)
    resolveReady(event.data.context)
  }

  selfWindow.addEventListener('message', handleInit)
  targetWindow.postMessage(readyMessage, targetOrigin)
  readyTimer = setInterval(() => {
    if (port || destroyed || readyAttempts >= READY_MAX_ATTEMPTS) {
      stopReadyRetry()
      return
    }
    readyAttempts += 1
    targetWindow.postMessage(readyMessage, targetOrigin)
  }, READY_RETRY_MS)

  function invoke<M extends BridgeMethod>(
    method: M,
    ...args: BridgeArgs<M>
  ): Promise<BridgeResult<M>> {
    return new Promise<BridgeResult<M>>((resolve, reject) => {
      if (destroyed) {
        reject(new StarhiveBridgeError(BridgeErrorCode.ChannelClosed, 'Bridge has been destroyed'))
        return
      }
      const send = (activePort: MessagePort) => {
        const id = createId()
        const request: BridgeRequest = { id, type: 'invoke', method, args: args as unknown[] }
        const timer = setTimeout(() => {
          pending.delete(id)
          reject(
            new StarhiveBridgeError(
              BridgeErrorCode.Timeout,
              `Bridge request "${method}" timed out after ${timeoutMs}ms`,
            ),
          )
        }, timeoutMs)
        pending.set(id, {
          resolve: resolve as (value: unknown) => void,
          reject,
          timer,
        })
        activePort.postMessage(request)
      }

      if (port) {
        send(port)
      } else {
        // Queue until the handshake completes; propagate handshake failure.
        ready.then(
          () => {
            if (destroyed || !port) {
              reject(
                new StarhiveBridgeError(
                  BridgeErrorCode.ChannelClosed,
                  'Bridge channel unavailable',
                ),
              )
              return
            }
            send(port)
          },
          (error: Error) =>
            reject(new StarhiveBridgeError(BridgeErrorCode.ChannelClosed, error.message)),
        )
      }
    })
  }

  function getContext(): HostContext {
    if (!context) {
      throw new StarhiveBridgeError(
        BridgeErrorCode.ChannelClosed,
        'Bridge context is not available yet — await `bridge.ready` first',
      )
    }
    return context
  }

  function deferResolve<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return fn()
    } catch (error) {
      return Promise.reject(error)
    }
  }

  function raise(message: string): never {
    throw new StarhiveBridgeError(BridgeErrorCode.BadRequest, message)
  }

  function resolveTypeKey(typeKey: string): string {
    const map = getContext().typeKeyToId
    const typeId = map[typeKey]
    if (!typeId) {
      throw new StarhiveBridgeError(
        BridgeErrorCode.BadRequest,
        `Unknown type key "${typeKey}". Known keys: ${Object.keys(map).join(', ') || '(none)'}`,
      )
    }
    return typeId
  }

  function resolveAttributeKey(attributeKey: string, typeKey?: string): string {
    const map = getContext().attributeKeyToId ?? {}
    const fullKey = typeKey ? `${typeKey}.${attributeKey}` : attributeKey
    const attributeId = map[fullKey]
    if (!attributeId) {
      throw new StarhiveBridgeError(
        BridgeErrorCode.BadRequest,
        `Unknown attribute key "${fullKey}". Known keys: ${Object.keys(map).join(', ') || '(none)'}`,
      )
    }
    return attributeId
  }

  const bridge: StarhiveBridge = {
    ready,
    isReady: () => context !== null,
    getContext,
    getTheme: () => getContext().theme,
    onContextChange(listener) {
      contextListeners.add(listener)
      return () => contextListeners.delete(listener)
    },
    invoke,
    resolveTypeKey,
    resolveAttributeKey,
    // `resolveTypeKey` can throw (unknown key / not ready); `deferResolve` turns
    // that into a rejected promise so callers never face a sync throw.
    getType: (typeKey) =>
      deferResolve(() => invoke('types.get', { typeId: resolveTypeKey(typeKey) })),
    listTypes: (options) => invoke('types.list', { spaceId: options?.spaceId }),
    objects: {
      create: (typeKey, attributes, writeOptions) =>
        deferResolve(() =>
          invoke('objects.create', {
            typeId: resolveTypeKey(typeKey),
            attributes,
            transitions: writeOptions?.transitions,
          }),
        ),
      get: (id) => invoke('objects.get', { id }),
      update: (id, attributes, writeOptions) =>
        invoke('objects.update', { id, attributes, transitions: writeOptions?.transitions }),
      remove: (id) => invoke('objects.remove', { id }),
      // Keys here, ids on the wire — resolved from the handshake maps, so an aggregate costs no type
      // fetch. `deferResolve` for the same reason `create` uses it: resolution throws synchronously
      // and no caller should have to handle both a throw and a rejection.
      aggregate: (request) =>
        deferResolve(() =>
          invoke('objects.aggregate', {
            typeId: resolveTypeKey(request.typeKey),
            where: request.where,
            operation: request.operation,
            attributeId:
              request.operation === 'count'
                ? undefined
                : resolveAttributeKey(
                    request.attribute ??
                      raise(`"${request.operation}" needs an attribute of "${request.typeKey}"`),
                    request.typeKey,
                  ),
            groupByAttributeId: request.groupBy
              ? resolveAttributeKey(request.groupBy, request.typeKey)
              : undefined,
          }),
        ),
      query: (starql, queryOptions) =>
        deferResolve(() =>
          invoke('objects.query', {
            starql,
            typeId:
              queryOptions?.typeId ??
              (queryOptions?.typeKey ? resolveTypeKey(queryOptions.typeKey) : undefined),
            offset: queryOptions?.offset,
            limit: queryOptions?.limit,
          }),
        ),
    },
    workflow: {
      transitions: (objectId, attributeId) =>
        invoke('workflow.transitions', { objectId, attributeId }),
    },
    remotes: () => invoke('remote.list'),
    fetch: (remote, path, init) =>
      invoke('remote.fetch', {
        remote,
        path,
        method: init?.method,
        headers: init?.headers,
        body: init?.body,
        cacheSeconds: init?.cacheSeconds,
      }).then((result) => ({
        ...result,
        ok: result.status >= 200 && result.status < 300,
        json<T = unknown>(): T {
          if (result.body === null) {
            throw new StarhiveBridgeError(
              BridgeErrorCode.BadRequest,
              `The response from "${remote}" had no body to parse`,
            )
          }
          return JSON.parse(result.body) as T
        },
      })),
    macro: {
      setState: (state) => {
        // Guarded here as well as host-side: a clear rejection in the app's own stack beats a
        // FORBIDDEN coming back from a message it should never have sent.
        if (getContext().slot !== 'macro') {
          return Promise.reject(
            new StarhiveBridgeError(
              BridgeErrorCode.Forbidden,
              'macro.setState is only available on the macro slot',
            ),
          )
        }
        return invoke('macro.setState', { state }).then((r) => r.state)
      },
    },
    config: {
      get: () => invoke('config.get').then((r) => r.config),
      set: (config) => {
        if (getContext().slot !== 'settingsPage') {
          return Promise.reject(
            new StarhiveBridgeError(
              BridgeErrorCode.Forbidden,
              'config.set is only available on the settingsPage slot',
            ),
          )
        }
        return invoke('config.set', { config }).then((r) => r.config)
      },
    },
    toast: (message, variant) => invoke('toast.show', { message, variant }).then(() => undefined),
    navigate: (to) => invoke('navigate', { to }).then(() => undefined),
    resize: (height) => invoke('frame.resize', { height }).then(() => undefined),
    destroy() {
      destroyed = true
      stopReadyRetry()
      selfWindow.removeEventListener('message', handleInit)
      if (port) {
        port.onmessage = null
        port.close()
        port = null
      }
      pending.forEach((entry) => {
        clearTimeout(entry.timer)
        entry.reject(new StarhiveBridgeError(BridgeErrorCode.ChannelClosed, 'Bridge destroyed'))
      })
      pending.clear()
      contextListeners.clear()
      rejectReady(new StarhiveBridgeError(BridgeErrorCode.ChannelClosed, 'Bridge destroyed'))
    },
  }

  // Avoid unhandled rejection if nobody awaits `ready` and the bridge is torn down.
  ready.catch(() => undefined)

  return bridge
}
