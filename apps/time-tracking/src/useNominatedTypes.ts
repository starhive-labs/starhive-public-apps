import { type BridgeType, useBridge, useConfig } from '@starhive/bridge'
import { useEffect, useState } from 'react'

import { readConfig } from './timeEntry'

export type NominatedType = {
  id: string
  name: string
  /** The attribute the type marks `isLabel` — what an object of it is called. */
  labelAttributeId?: string
}

/**
 * The types an admin nominated, with enough of each schema to name its objects.
 *
 * Fetched imperatively rather than through `useTypeById`, because the count is whatever the admin
 * chose and a hook cannot be called in a loop. A type that cannot be read is dropped rather than
 * failing the lot: an admin may nominate a type, and a given viewer may still not see it, and that
 * viewer should get the rest of the picker rather than none of it.
 */
export function useNominatedTypes(): {
  types: NominatedType[]
  isLoading: boolean
  /** Type ids from the settings that could not be read, for a screen that wants to say so. */
  unreadable: string[]
} {
  const bridge = useBridge()
  const { config, isLoading: configLoading } = useConfig()
  // A string, so the effect depends on what the setting says rather than on a new array each render.
  const typeIds = readConfig(config).workItemTypes.join(' ')

  const [state, setState] = useState<{
    types: NominatedType[]
    unreadable: string[]
    isLoading: boolean
  }>({ types: [], unreadable: [], isLoading: true })

  useEffect(() => {
    const ids = typeIds ? typeIds.split(' ') : []
    if (ids.length === 0) {
      setState({ types: [], unreadable: [], isLoading: false })
      return
    }
    let active = true
    setState((previous) => ({ ...previous, isLoading: true }))

    Promise.all(
      ids.map((id) =>
        bridge
          .invoke('types.get', { typeId: id })
          .then((type: BridgeType) => ({ id, type }))
          .catch(() => ({ id, type: undefined })),
      ),
    ).then((results) => {
      if (!active) return
      setState({
        types: results
          .filter((result): result is { id: string; type: BridgeType } => Boolean(result.type))
          .map(({ id, type }) => ({
            id,
            name: type.name,
            labelAttributeId: type.attributes.find((attribute) => attribute.isLabel)?.id,
          })),
        unreadable: results.filter((result) => !result.type).map((result) => result.id),
        isLoading: false,
      })
    })

    return () => {
      active = false
    }
  }, [bridge, typeIds])

  return { ...state, isLoading: state.isLoading || configLoading }
}
