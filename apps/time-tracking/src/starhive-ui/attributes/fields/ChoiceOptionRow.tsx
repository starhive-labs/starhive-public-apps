import { Group, Text } from '@mantine/core'

import type { Density } from '../model'
import { EntityIcon } from '../primitives/EntityIcon'
import type { ChoiceOption } from './types'

/**
 * The picture beside a candidate — the same precedence a reference chip uses, via one component.
 */
export function ChoiceOptionIcon({
  option,
  density = 'default',
}: {
  option: ChoiceOption
  density?: Density
}) {
  return (
    <EntityIcon
      label={option.label}
      avatarUrl={option.avatarUrl}
      iconUrl={option.iconUrl}
      iconColor={option.iconColor}
      density={density}
    />
  )
}

/** A candidate as it appears in the dropdown and as the selected value. */
export function ChoiceOptionRow({
  option,
  density = 'default',
}: {
  option: ChoiceOption
  density?: Density
}) {
  return (
    <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
      <ChoiceOptionIcon option={option} density={density} />
      <Text size="sm" truncate="end">
        {option.label}
      </Text>
    </Group>
  )
}
