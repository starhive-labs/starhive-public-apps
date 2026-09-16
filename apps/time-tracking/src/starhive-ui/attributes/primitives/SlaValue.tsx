import { Group, Text } from '@mantine/core'

import { formatDateTime } from '../format'
import type { Density, SlaView } from '../model'
import { StateBadge } from './StateBadge'
import type { StateColor } from '../model'

/** Running is on-track (green), paused is on hold (yellow), stopped is finished (gray). */
const STATUS_COLOR: Record<SlaView['status'], StateColor> = {
  RUNNING: 'GREEN',
  PAUSED: 'YELLOW',
  STOPPED: 'GRAY',
}

const STATUS_LABEL: Record<SlaView['status'], string> = {
  RUNNING: 'Running',
  PAUSED: 'Paused',
  STOPPED: 'Stopped',
}

/**
 * An SLA's state and what is left of it.
 *
 * Portable in a way the product's own SLA renderer is not: everything shown comes off the value's
 * own details, so there is nothing to fetch. It does not tick — the remaining duration is what the
 * host computed when the object was read.
 */
export function SlaValue({ sla, density = 'default' }: { sla: SlaView; density?: Density }) {
  const detail =
    sla.remainingDuration ??
    (sla.dueDateTime ? `due ${formatDateTime(sla.dueDateTime, { short: true })}` : undefined)

  return (
    <Group component="span" display="inline-flex" gap="xs" wrap="nowrap">
      <StateBadge
        name={STATUS_LABEL[sla.status]}
        color={STATUS_COLOR[sla.status]}
        isEndState={sla.status === 'STOPPED'}
      />
      {detail && density !== 'compact' ? (
        <Text component="span" size="xs" c="dimmed">
          {detail}
        </Text>
      ) : null}
    </Group>
  )
}
