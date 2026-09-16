import { Skeleton, Stack, Text } from '@mantine/core'
import { Card } from '@starhive/ui'

/**
 * One figure, and what it is a figure of.
 *
 * A stat tile rather than a one-bar chart: a single number wants to be read, not compared. The
 * value takes the font's proportional digits — tabular ones are for columns, and a standalone `11`
 * as wide as `88` looks broken.
 */
export function StatTile({
  label,
  value,
  hint,
  loading = false,
  bare = false,
}: {
  label: string
  value: string | number
  /** One line under the value, when the number needs a caveat rather than a bigger label. */
  hint?: string
  loading?: boolean
  /** No card around it — for a widget, whose dashboard cell already draws the frame. */
  bare?: boolean
}) {
  const body = (
    <Stack gap={2}>
      {loading ? (
        <Skeleton height={30} width={64} radius="sm" />
      ) : (
        <Text fz={28} fw={600} lh={1.1}>
          {value}
        </Text>
      )}
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      {hint && (
        <Text size="xs" c="dimmed" opacity={0.8}>
          {hint}
        </Text>
      )}
    </Stack>
  )
  return bare ? body : <Card>{body}</Card>
}
