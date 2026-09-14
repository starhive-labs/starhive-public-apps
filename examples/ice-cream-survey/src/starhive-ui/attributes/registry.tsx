import { createContext, type ComponentType, type ReactNode, useContext, useMemo } from 'react'

import type {
  AttributeConfigurationView,
  Density,
  LocationView,
  MediaView,
  SlaView,
  StateColor,
  UserView,
  ReferenceView,
} from './model'
import { Chip } from './primitives/Chip'
import { DateRangeText } from './primitives/DateRangeText'
import { DateText } from './primitives/DateText'
import { LinkValue } from './primitives/LinkValue'
import { LocationValue } from './primitives/LocationValue'
import { MediaValue } from './primitives/MediaValue'
import { NoValue } from './primitives/NoValue'
import { PriorityValue } from './primitives/PriorityValue'
import { RatingStars } from './primitives/RatingStars'
import { ReferenceChip } from './primitives/ReferenceChip'
import { RestrictedValue } from './primitives/RestrictedValue'
import { SlaValue } from './primitives/SlaValue'
import { StateBadge } from './primitives/StateBadge'
import { TextValue } from './primitives/TextValue'
import { UserChip } from './primitives/UserChip'
import { ValueGroup } from './primitives/ValueGroup'

/**
 * The visual leaves `<AttributeValue>` draws with, each replaceable.
 *
 * **Why this exists.** The thing that actually drifts between two attribute renderers is not the
 * pixels — the design system already governs those — it is the *decisions*: which formatter a
 * `DECIMAL` gets, how an `OPTION` id resolves to a name, what "no value" means versus "withheld",
 * whether a deleted user stays distinguishable, which types collapse into a chip row. Those live in
 * the dispatcher and are tested once.
 *
 * The pixels are the part a host may legitimately already own. platform-ui's leaves are wired into
 * its own design system in ways a package for app bundles should not drag along: its chip is the
 * multi-select's `MultiSelectSelectedItem` (which pulls in three avatar components, the 187-icon
 * sprite and a *fetching* state badge), its typography goes through `@mantine/emotion`, and its
 * multi-value wrapper measures real available width with an IntersectionObserver rather than
 * guessing at a fixed limit.
 *
 * So the product supplies its own leaves and keeps its exact appearance, while sharing every
 * decision above them. An app supplies none and gets the defaults.
 */
export type AttributePrimitives = {
  Text?: ComponentType<{ value: string; density?: Density }>
  /**
   * A formatted number. Separate from `Text` because a host may well style numbers differently —
   * platform-ui truncates them with an ellipsis rather than wrapping on word boundaries. Receives the
   * already-formatted string plus the raw one, so an override never re-implements the formatting.
   */
  Number?: ComponentType<{
    value: string
    formatted: string
    isInteger: boolean
    density?: Density
  }>
  Link?: ComponentType<{ value: string; kind: 'EMAIL' | 'URL'; density?: Density }>
  Date?: ComponentType<{ value: string; formatted: string }>
  /** A date range. Gets both ends raw and formatted, so each can keep its own `<time>`. */
  DateRange?: ComponentType<{
    from: string
    to: string
    formattedFrom: string
    formattedTo: string
    density?: Density
  }>
  Chip?: ComponentType<{ label: string; leading?: ReactNode; density?: Density; title?: string }>
  StateBadge?: ComponentType<{
    name: string
    color?: StateColor
    isEndState?: boolean
    emphasized?: boolean
    /** The workflow driving the state, for a host that resolves colours itself. */
    workflowId?: string
    stateId?: string
  }>
  UserChip?: ComponentType<{ user: UserView; density?: Density }>
  ReferenceChip?: ComponentType<{ reference: ReferenceView; density?: Density }>
  Media?: ComponentType<{ media: MediaView; url?: string; density?: Density }>
  Location?: ComponentType<{ value?: string; location: LocationView; density?: Density }>
  Rating?: ComponentType<{ value: string; maxRating?: number; allowHalfValues?: boolean }>
  Priority?: ComponentType<{
    value: string
    configuration?: AttributeConfigurationView
    density?: Density
  }>
  Sla?: ComponentType<{ sla: SlaView; density?: Density }>
  NoValue?: ComponentType
  Restricted?: ComponentType
  /** The multi-value wrapper. Override to keep a host's own overflow behaviour. */
  Group?: ComponentType<{ children: ReactNode[]; density: Density; count: number }>
}

/** Every leaf resolved — defaults, with any override applied. */
export type ResolvedPrimitives = Required<AttributePrimitives>

const DEFAULTS: ResolvedPrimitives = {
  Text: TextValue,
  // By default a number reads like any other text; only a host that styles them apart overrides it.
  Number: ({ formatted, density }) => <TextValue value={formatted} density={density} />,
  Link: LinkValue,
  Date: DateText,
  DateRange: DateRangeText,
  Chip,
  StateBadge,
  UserChip,
  ReferenceChip,
  Media: MediaValue,
  Location: LocationValue,
  Rating: RatingStars,
  Priority: PriorityValue,
  Sla: SlaValue,
  NoValue,
  Restricted: RestrictedValue,
  Group: ValueGroup,
}

const PrimitivesContext = createContext<AttributePrimitives>({})

/**
 * Replace some or all of the leaves for the renderers below.
 *
 * ```tsx
 * <AttributePrimitivesProvider primitives={{ Chip: MultiSelectSelectedItemAdapter }}>
 * ```
 *
 * Nesting merges: an inner provider's overrides win, and anything it leaves out falls through to the
 * outer one and then to the defaults.
 */
export function AttributePrimitivesProvider({
  primitives,
  children,
}: {
  primitives: AttributePrimitives
  children: ReactNode
}) {
  const outer = useContext(PrimitivesContext)
  const merged = useMemo(() => ({ ...outer, ...primitives }), [outer, primitives])
  return <PrimitivesContext.Provider value={merged}>{children}</PrimitivesContext.Provider>
}

export function useAttributePrimitives(): ResolvedPrimitives {
  const overrides = useContext(PrimitivesContext)
  return useMemo(() => ({ ...DEFAULTS, ...overrides }), [overrides])
}
