import { displayOf, useAttributes, useObject, useObjectQuery, useTypeById } from '@starhive/bridge'
import { useMemo } from 'react'

import { ATTR, ATTR_NAME, CODE_LINK_KEY } from './codeLink'

export type WorkItem = {
  /** The work item's own label — the value of the attribute its type marks `isLabel`. */
  label?: string
  /** Its SEQUENCE value, when the type has one and the app is allowed to read the object. */
  sequence?: string
  /**
   * Every attribute it has a value for, by display name, so a naming template can name one.
   *
   * Display name rather than key: these belong to a type this app does not own, so they have no
   * manifest key, and the name is what an admin sees in the product and types into the template.
   */
  attributes: Record<string, string>
  /** Every attribute its type declares, named or not — what a template *could* use. */
  attributeNames: string[]
  /** True when the work item is one this app may read, so label and sequence are both first-hand. */
  readable: boolean
  isLoading: boolean
  /**
   * Why the name is missing a key, or missing entirely — in the words of whichever step failed.
   *
   * Every one of these ends in the same branch name, `work-<id>`, and they have completely different
   * fixes: a refused read is a configuration problem, a type with no SEQUENCE is a modelling choice,
   * and an unset key is just a new object. Undefined when there is nothing to explain.
   */
  problem?: string
}

/**
 * What the panel can learn about the object it is mounted on.
 *
 * The object is readable whichever type it is, now that the host lets an app read the types its own
 * config-bound references point at — this app writes a `workItem` reference to it, so it may read it
 * back. So the label is the value of the attribute its type marks `isLabel` (not the first attribute
 * that happens to hold something, and not one named by guesswork: `isLabel` is the type's own answer
 * to "what is this object called"), and a `SEQUENCE` attribute is read the same way, on the app's own
 * `Work Item` and on whatever type an admin pointed the setting at alike.
 *
 * The long way round is kept as a fallback rather than deleted: the host resolves a reference's
 * target label onto the value it returns, so this app's own link row still tells us the name of the
 * work item even against a host too old to allow the direct read, or if the object goes unreadable
 * for a reason of its own — a permission, a deletion.
 */
export function useWorkItem(objectId: string | undefined): WorkItem {
  // Rejects for a work item outside this app's scope. That is an answer, not a failure — it decides
  // which of the two routes applies — so the error is read rather than surfaced.
  const { data: object, isLoading: objectLoading, error: objectError } = useObject(objectId)
  const { data: type, isLoading: typeLoading, error: typeError } = useTypeById(object?.typeId)

  const linkColumns = useAttributes(CODE_LINK_KEY, [ATTR.workItem])
  const { data: links, isLoading: linksLoading } = useObjectQuery(
    objectId ? `"${ATTR_NAME.workItem}" = objectId("${objectId}") order by Created desc` : '',
    { typeKey: CODE_LINK_KEY, limit: 1 },
  )

  const firstHand = useMemo(() => {
    if (!object || !type) {
      return {
        label: undefined,
        sequence: undefined,
        problem: undefined,
        attributes: {} as Record<string, string>,
        attributeNames: [] as string[],
      }
    }
    const labelAttribute = type.attributes.find((attribute) => attribute.isLabel)
    const sequenceAttribute = type.attributes.find(
      (attribute) => attribute.attributeTypeCode === 'SEQUENCE',
    )
    const label = labelAttribute ? displayOf(object, labelAttribute.id) : undefined
    const sequence = sequenceAttribute ? displayOf(object, sequenceAttribute.id) : undefined

    // Reported in the order the name is built, so the first thing missing is the thing named.
    const problem = !labelAttribute
      ? `“${type.name}” marks no attribute as its label, so there is no name to use.`
      : !sequenceAttribute
        ? `“${type.name}” has no SEQUENCE attribute, so there is no key for the name. A key on a type it extends counts — this list is inherited.`
        : !sequence
          ? `This object has no value for “${sequenceAttribute.name}” yet.`
          : undefined
    const attributes: Record<string, string> = {}
    for (const attribute of type.attributes) {
      const value = displayOf(object, attribute.id)
      if (value) attributes[attribute.name] = value
    }

    return {
      label,
      sequence,
      problem,
      attributes,
      attributeNames: type.attributes.map((attribute) => attribute.name),
    }
  }, [object, type])

  const fromOurOwnRow = useMemo(() => {
    const attributeId = linkColumns.data[0]?.id
    const first = links?.result[0]
    if (!attributeId || !first) return undefined
    return displayOf(first, attributeId)
  }, [links, linkColumns.data])

  const isLoading = objectLoading || typeLoading || linksLoading || linkColumns.isLoading

  /*
   * Every way this can go wrong, each said in its own words — and a catch-all, because the failure
   * being diagnosed is one where nothing was said at all.
   *
   * The last branch matters more than it looks: a read that resolves with nothing, rather than
   * rejecting, leaves no error to report and no data to use, and reporting silence as "cannot be
   * read" would send someone to check a permission that is fine. It names the ids instead, which is
   * the one thing always true and always enough to look the objects up.
   */
  const problem = objectError
    ? `This object cannot be read: ${objectError.message}`
    : typeError
      ? `Its type (${object?.typeId ?? 'unknown'}) cannot be read: ${typeError.message}`
      : (firstHand.problem ??
        (!isLoading && !object
          ? `The read of ${objectId} returned nothing, and did not say why.`
          : !isLoading && !type
            ? `The read of type ${object?.typeId} returned nothing, and did not say why.`
            : undefined))

  return {
    label: firstHand.label ?? fromOurOwnRow,
    sequence: firstHand.sequence,
    attributes: firstHand.attributes,
    attributeNames: firstHand.attributeNames,
    readable: Boolean(object),
    isLoading,
    problem,
  }
}
