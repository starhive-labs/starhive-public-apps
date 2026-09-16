import type { Density, UserView } from '../model'
import { Avatar } from './Avatar'
import { Chip } from './Chip'

/**
 * A user reference.
 *
 * A deleted user is rendered as such rather than as a blank or a raw id: the account is gone but the
 * fact that it was them is still the truth about this object, and hiding it loses history.
 */
export function UserChip({ user, density = 'default' }: { user: UserView; density?: Density }) {
  if (user.isDeleted) {
    return <Chip label="Deleted user" density={density} title="This user has been deleted" />
  }
  const label = user.name || user.email || user.id
  return (
    <Chip
      label={label}
      density={density}
      title={user.email && user.name ? `${user.name} (${user.email})` : label}
      leading={<Avatar label={label} density={density} />}
    />
  )
}
