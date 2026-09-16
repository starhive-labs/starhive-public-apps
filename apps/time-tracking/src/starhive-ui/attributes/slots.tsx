import { createContext, type ReactElement, type ReactNode, useContext } from 'react'

import type { AttributeView, AttributeValueView } from './model'

/**
 * The parts of rendering an attribute that this package deliberately cannot do.
 *
 * Everything here needs something a pure renderer has no business owning: a network call, an auth
 * context, a router, a Google Maps key, a TipTap instance. The product's own renderer does all of it
 * inline (`DataFieldValue` runs a `useQuery`, `StateBadgeWithFetch` fetches mid-render), which is
 * exactly why it could not be shared.
 *
 * So they become **slots**. platform-ui fills them with the real hover cards, preview modals and
 * maps; an app fills none and gets a static, correct, well-formatted value. A slot that is not
 * provided is not an error and not a blank — every caller of a slot has a working fallback.
 */
export type AttributeSlots = {
  /**
   * Wrap a reference chip in the product's object preview card.
   * Return `children` unchanged to opt out for one value.
   */
  referenceHover?: (args: {
    value: AttributeValueView
    attribute: AttributeView
    children: ReactElement
  }) => ReactNode
  /** Wrap a user chip in the product's user preview card. */
  userHover?: (args: { value: AttributeValueView; children: ReactElement }) => ReactNode
  /** Wrap a workflow badge in the product's workflow preview card. */
  workflowHover?: (args: {
    value: AttributeValueView
    attribute: AttributeView
    children: ReactElement
  }) => ReactNode
  /**
   * Turn a media value into a URL this viewer can actually load.
   *
   * Media URLs are auth-scoped and host-relative, so the host resolves them. Without this slot the
   * renderer uses `media.thumbnailUrl` when the host already put an absolute one on the value, and
   * falls back to a filename chip when it did not.
   */
  resolveMediaUrl?: (args: {
    value: AttributeValueView
    attribute: AttributeView
  }) => string | undefined
  /** Draw a map for a LOCATION value. Without it, the coordinates are shown as text. */
  renderMap?: (args: { latitude: number; longitude: number }) => ReactNode
  /**
   * Render a RICH_TEXT value (a TipTap document as JSON).
   *
   * Not implemented here on purpose: the product's renderer pulls in TipTap, a syntax highlighter, a
   * router and mention enrichment. Without this slot the value degrades to its plain text, which is
   * correct and readable — see `richTextToPlainText`.
   */
  renderRichText?: (args: { value: AttributeValueView; attribute: AttributeView }) => ReactNode
  /**
   * Move a `WORKFLOW` value. Without it the state renders read-only.
   *
   * A move is not a field edit: which moves exist depends on the state the object is in and on
   * conditions that can involve the current user, so it needs the object and a `workflow.transitions`
   * call. `@starhive/ui`'s `<ObjectField>` fills this with `<WorkflowControl>`.
   */
  renderWorkflowField?: (args: {
    attribute: AttributeView
    values: AttributeValueView[]
    onChange: (values: string[], options?: { transitions?: Record<string, string> }) => void
    disabled?: boolean
  }) => ReactNode
  /**
   * Edit a `RICH_TEXT` value. Without it the document renders read-only — a plain textarea would
   * overwrite formatting, which is worse than not offering the edit.
   */
  renderRichTextField?: (args: {
    attribute: AttributeView
    values: AttributeValueView[]
    onChange: (values: string[]) => void
    disabled?: boolean
  }) => ReactNode
  /**
   * Anything the package has no renderer for: `COMPLETENESS`, `DEPRECIATION`, and any attribute type
   * code added to the product after this version. Return nothing to accept the text fallback.
   */
  renderFallback?: (args: {
    value: AttributeValueView
    attribute: AttributeView
  }) => ReactNode | undefined
}

const AttributeSlotsContext = createContext<AttributeSlots>({})

/**
 * Provide host capabilities to the attribute renderers below it.
 *
 * ```tsx
 * <AttributeSlotsProvider slots={{ referenceHover: ({ children, value }) => (
 *   <ObjectPreviewCard objectId={value.value}>{children}</ObjectPreviewCard>
 * ) }}>
 * ```
 */
export function AttributeSlotsProvider({
  slots,
  children,
}: {
  slots: AttributeSlots
  children: ReactNode
}) {
  return <AttributeSlotsContext.Provider value={slots}>{children}</AttributeSlotsContext.Provider>
}

export function useAttributeSlots(): AttributeSlots {
  return useContext(AttributeSlotsContext)
}
