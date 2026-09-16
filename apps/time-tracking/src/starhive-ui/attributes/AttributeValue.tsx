import { Fragment, type ReactNode } from 'react'

import { formatDate, formatDateTime, formatNumberFor, splitDateRange } from './format'
import {
  type AttributeValueView,
  type AttributeView,
  type Density,
  type ObjectView,
  optionNameFor,
  stateFor,
  valuesOf,
} from './model'
import { type ResolvedPrimitives, useAttributePrimitives } from './registry'
import { richTextToPlainText } from './richText'
import { type AttributeSlots, useAttributeSlots } from './slots'

/** Attribute types whose several values read as a row of chips rather than stacked lines. */
const CHIP_ROW_TYPES = new Set([
  'REFERENCE',
  'MEDIA',
  'OPTION',
  'USER',
  'BOOLEAN',
  'SYSTEM_CREATOR',
])

export type AttributeValueProps = {
  attribute: AttributeView
  /** Values to draw. Give this, or `object` to have them read off it. */
  values?: AttributeValueView[]
  /** The object holding the values — the shape platform-ui and the bridge both already have. */
  object?: ObjectView
  density?: Density
  /** Object-details-header treatment for the types that have one (currently WORKFLOW). */
  emphasized?: boolean
}

/**
 * One attribute's value, drawn the way Starhive draws it.
 *
 * **Pure.** No fetching, no react-query, no router, no auth — hand it an attribute and its values and
 * it returns pixels. That is the design constraint that makes it shareable at all: the product's own
 * `DataFieldValue` runs a `useQuery` for the type and a suspense query for state colours *mid-render*,
 * which is exactly why it could never be drawn inside a sandboxed app iframe.
 *
 * What is shared is every **decision**: which formatter each type gets, how an option id becomes a
 * name, what "no value" means as against "withheld", which types collapse into a chip row. The
 * **pixels** are replaceable — see {@link AttributePrimitives} — so the product keeps its own leaves
 * and its exact appearance while still sharing the logic above them. Anything needing a host lives in
 * {@link AttributeSlots}, and every slot has a working fallback.
 *
 * ```tsx
 * <AttributeValue attribute={attribute} object={object} density="table" />
 * ```
 */
export function AttributeValue({
  attribute,
  values,
  object,
  density = 'default',
  emphasized = false,
}: AttributeValueProps): ReactNode {
  const slots = useAttributeSlots()
  const primitives = useAttributePrimitives()
  const resolved = values ?? (object ? valuesOf(object, attribute.id) : [])

  if (resolved.length === 0) return <primitives.NoValue />

  const rendered = resolved.map((value) => (
    <Fragment key={value.valueId}>
      {renderOne({ attribute, value, density, emphasized, slots, primitives })}
    </Fragment>
  ))

  if (resolved.length === 1) return rendered

  // Only the chip-shaped types read as a row; the rest stack, which is what the product does.
  if (!CHIP_ROW_TYPES.has(attribute.attributeTypeCode)) return rendered

  return (
    <primitives.Group density={density} count={resolved.length}>
      {rendered}
    </primitives.Group>
  )
}

type RenderArgs = {
  attribute: AttributeView
  value: AttributeValueView
  density: Density
  emphasized: boolean
  slots: AttributeSlots
  primitives: ResolvedPrimitives
}

function renderOne(args: RenderArgs): ReactNode {
  const { attribute, value, density, emphasized, slots, primitives: p } = args

  // Checked before the type switch: a withheld value has no content to dispatch on, whatever its
  // attribute type says.
  if (value.restricted) return <p.Restricted />

  const configuration = attribute.configuration

  switch (attribute.attributeTypeCode) {
    // ---- text-ish -------------------------------------------------------------------
    case 'TEXT':
    case 'COMPOSITE':
    case 'IP_ADDRESS':
    case 'SEQUENCE':
    case 'STREAM':
    case 'RANK':
      return <p.Text value={value.value} density={density} />

    case 'EMAIL':
    case 'URL':
      return <p.Link value={value.value} kind={attribute.attributeTypeCode} density={density} />

    case 'RICH_TEXT': {
      const slotted = slots.renderRichText?.({ value, attribute })
      if (slotted !== undefined && slotted !== null) return slotted
      // No slot: the document's plain text. Correct and readable — see richTextToPlainText, which
      // also picks up mentions, whose visible text is not in a text node.
      return <p.Text value={richTextToPlainText(value.value)} density={density} />
    }

    // ---- numbers --------------------------------------------------------------------
    case 'INTEGER':
      return (
        <p.Number
          value={value.value}
          formatted={formatNumberFor(value.value, true, configuration)}
          isInteger
          density={density}
        />
      )

    case 'DECIMAL':
    case 'CALCULATED':
      return (
        <p.Number
          value={value.value}
          formatted={formatNumberFor(value.value, false, configuration)}
          isInteger={false}
          density={density}
        />
      )

    case 'RATING':
      return (
        <p.Rating
          value={value.value}
          maxRating={configuration?.maxRating}
          allowHalfValues={configuration?.allowHalfValues}
        />
      )

    // ---- dates ----------------------------------------------------------------------
    case 'DATE':
      return <p.Date value={value.value} formatted={formatDate(value.value, { short: true })} />

    case 'DATETIME':
    case 'SYSTEM_CREATED':
    case 'SYSTEM_UPDATED':
      return <p.Date value={value.value} formatted={formatDateTime(value.value, { short: true })} />

    case 'DATE_RANGE':
      return (
        <p.DateRange
          {...splitDateRange(value.value, configuration?.dateRangeType)}
          density={density}
        />
      )

    // ---- chips ----------------------------------------------------------------------
    case 'BOOLEAN':
      return <p.Chip label={capitalize(value.value)} density={density} />

    case 'OPTION':
      return <p.Chip label={optionNameFor(attribute, value.value)} density={density} />

    case 'PRIORITY':
      return <p.Priority value={value.value} configuration={configuration} density={density} />

    case 'REFERENCE': {
      if (!value.ref) {
        // The host did not enrich it, so all there is is the target's id. Better than nothing, and
        // the reason `display` and `ref` are both optional in the model.
        return <p.Text value={value.display ?? value.value} density={density} />
      }
      const chip = <p.ReferenceChip reference={value.ref} density={density} />
      return slots.referenceHover?.({ value, attribute, children: chip }) ?? chip
    }

    case 'USER':
    case 'SYSTEM_CREATOR': {
      if (!value.user) return <p.Text value={value.display ?? value.value} density={density} />
      const chip = <p.UserChip user={value.user} density={density} />
      return slots.userHover?.({ value, children: chip }) ?? chip
    }

    case 'WORKFLOW': {
      if (!value.state) return <p.Text value={value.display ?? value.value} density={density} />
      // The colour is schema, joined from the attribute's own state list — no fetch, and no default
      // baked into the wire, so a host that could not reach the colour service still draws right.
      // `workflowId`/`stateId` ride along for a host whose badge resolves colours its own way.
      const state = stateFor(attribute, value)
      const badge = (
        <p.StateBadge
          name={value.state.name}
          color={state?.color}
          isEndState={value.state.isEndState}
          emphasized={emphasized}
          workflowId={attribute.workflowId}
          stateId={value.state.id}
        />
      )
      return slots.workflowHover?.({ value, attribute, children: badge }) ?? badge
    }

    // ---- media & geo ----------------------------------------------------------------
    case 'MEDIA':
    case 'SYSTEM_IMAGE': {
      if (!value.media) return <p.Text value={value.value} density={density} />
      return (
        <p.Media
          media={value.media}
          url={slots.resolveMediaUrl?.({ value, attribute })}
          density={density}
        />
      )
    }

    case 'LOCATION': {
      if (!value.location) return <p.Text value={value.value} density={density} />
      return (
        slots.renderMap?.({
          latitude: value.location.latitude,
          longitude: value.location.longitude,
        }) ?? <p.Location value={value.value} location={value.location} density={density} />
      )
    }

    case 'SLA':
      return value.sla ? (
        <p.Sla sla={value.sla} density={density} />
      ) : (
        <p.Text value={value.value} density={density} />
      )

    // ---- not rendered here ----------------------------------------------------------
    // COMPLETENESS and DEPRECIATION need the object's *other* attribute values (a completeness ring
    // counts filled siblings; depreciation reads a purchase price and a schedule off named
    // attributes), which is more than "this attribute, this value" — so they fall through to the
    // slot, then to text.
    default:
      break
  }

  const slotted = slots.renderFallback?.({ value, attribute })
  if (slotted !== undefined && slotted !== null) return slotted
  return <p.Text value={value.display ?? value.value} density={density} />
}

function capitalize(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : value
}
