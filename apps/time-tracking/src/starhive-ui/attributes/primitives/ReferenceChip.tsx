import type { Density, ReferenceView } from '../model'
import { Chip } from './Chip'
import { EntityIcon } from './EntityIcon'

/**
 * An object reference: the target's label with its picture, never its uuid.
 *
 * The picture is the target's own avatar when it has one, else its **type's icon** — which is what
 * the product shows, and what tells a reader what kind of thing they are looking at.
 */
export function ReferenceChip({
  reference,
  density = 'default',
}: {
  reference: ReferenceView
  density?: Density
}) {
  return (
    <Chip
      label={reference.label}
      density={density}
      leading={
        <EntityIcon
          label={reference.label}
          avatarUrl={reference.avatarUrl}
          iconUrl={reference.iconUrl}
          iconColor={reference.iconColor}
          density={density}
        />
      }
    />
  )
}
