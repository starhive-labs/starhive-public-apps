import type { ChoiceOption } from '@starhive/attributes'
import { displayOf, useObjectQuery, useType } from '@starhive/bridge'
import type { BridgeObject, BridgeType } from '@starhive/bridge'
import { useMemo } from 'react'

/**
 * Candidates for a `REFERENCE` field: the objects of a type, named and pictured the way a reference
 * chip is in the product.
 *
 * There were two hand-rolled copies of this and they disagreed — one read `values[0].display` only,
 * which is `undefined` for a plain `TEXT` label attribute (the host only sets `display` where it
 * resolved something), so every option fell through to showing the object's UUID. `displayOf` falls
 * back to the raw value, which is the label's text.
 */
export function useObjectCandidates(
  typeKey: string | undefined,
  enabled: boolean,
): { options?: ChoiceOption[]; isLoading: boolean } {
  const active = enabled && Boolean(typeKey)

  const type = useType(active ? (typeKey as string) : '')
  const { data, isLoading } = useObjectQuery(active ? 'order by Created desc' : '', {
    typeKey: active ? typeKey : undefined,
    limit: 100,
  })

  const options = useMemo<ChoiceOption[] | undefined>(() => {
    if (!active || !data || !type.data) return undefined
    const label = labelAttributeId(type.data)
    const avatar = systemImageAttributeId(type.data)
    // Every object of a type shares its type icon; only the avatar is per object. The host always
    // sends one — it defaults a type with no configured icon the way the product does.
    const iconUrl = type.data.icon.url20
    const iconColor = type.data.icon.color

    return data.result.map((candidate) => ({
      value: candidate.id,
      label: (label ? displayOf(candidate, label) : undefined) ?? candidate.id,
      ...(avatarUrlOf(candidate, avatar) ? { avatarUrl: avatarUrlOf(candidate, avatar) } : {}),
      ...(iconUrl ? { iconUrl } : {}),
      ...(iconColor ? { iconColor } : {}),
    }))
  }, [active, data, type.data])

  return { options, isLoading: active && (isLoading || type.isLoading) }
}

/** The attribute whose value names an object — the same one a reference chip shows. */
export function labelAttributeId(type: BridgeType): string | undefined {
  return type.attributes.find((attribute) => attribute.isLabel)?.id
}

/** An object's own picture, if its type has one. */
function systemImageAttributeId(type: BridgeType): string | undefined {
  return type.attributes.find((attribute) => attribute.attributeTypeCode === 'SYSTEM_IMAGE')?.id
}

function avatarUrlOf(object: BridgeObject, attributeId: string | undefined): string | undefined {
  if (!attributeId) return undefined
  const value = object.attributes.find((one) => one.attributeId === attributeId)?.values[0]
  return value?.media?.thumbnailUrl
}
