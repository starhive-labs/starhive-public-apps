import { displayOf, useObject, useTypeById } from '@starhive/bridge'

export type WorkItem = {
  /** What the object is called — the value of the attribute its type marks `isLabel`. */
  label?: string
  /** Its type's id, stored on every entry written against it. */
  typeId?: string
  /** Its type's name, for "on this Project". */
  typeName?: string
  /** True once the object has been read, which is also what says time may be logged on it. */
  readable: boolean
  isLoading: boolean
  /** Why it cannot be read, when it cannot. */
  problem?: string
}

/**
 * The object a Time tab is opened on.
 *
 * An `objectPanel` is handed `context.objectId` and nothing else, so the object's name has to be
 * read — and the read doubles as the check. The host lets an app read the types its manifest's
 * `scopes.read` nominates, and their subtypes; anything else is refused. So an object that reads is
 * one this app is meant to track time on, and one that does not is one the panel should not offer to
 * log against. The tab is normally never drawn there (`showFor` in the manifest, bound to the same
 * setting), but an app that trusts the tab alone shows a form that fails on submit.
 *
 * The name read here is also the one written onto every entry logged from this panel, which is what
 * keeps the stored copy current for the objects people are actually tracking time on.
 */
export function useWorkItem(objectId: string | undefined): WorkItem {
  const { data: object, isLoading: objectLoading, error: objectError } = useObject(objectId)
  const { data: type, isLoading: typeLoading, error: typeError } = useTypeById(object?.typeId)

  const labelAttribute = type?.attributes.find((attribute) => attribute.isLabel)
  const label = object && labelAttribute ? displayOf(object, labelAttribute.id) : undefined

  const problem = !objectId
    ? 'This panel is not open on an object.'
    : objectError
      ? `This object cannot be read: ${objectError.message}`
      : typeError
        ? `Its type cannot be read: ${typeError.message}`
        : undefined

  return {
    label,
    typeId: object?.typeId,
    typeName: type?.name,
    readable: Boolean(object),
    isLoading: Boolean(objectId) && (objectLoading || typeLoading),
    problem,
  }
}
