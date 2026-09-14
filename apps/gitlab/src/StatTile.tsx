import { Skeleton, Stack, Text } from '@mantine/core'

import { Card } from '@starhive/ui'

/**
 * One figure, and what it is a figure of.
 *
 * The value carries the font's proportional digits rather than tabular ones: tabular gives every
 * digit the width of a zero, which is right in a column of numbers and wrong for a standalone one,
 * where `11` ends up as wide as `88` and looks broken.
 *
 * The label is the sentence it belongs to, so it stays sentence case and takes no trailing colon.
 */
export function StatTile({
  label,
  value,
  hint,
  loading = false,
}: {
  label: string
  value: string | number
  /** One line under the value, when the number needs a caveat rather than a bigger label. */
  hint?: string
  loading?: boolean
}) {
  return (
    <Card>
      <Stack gap={2}>
        {loading ? (
          <Skeleton height={30} width={56} radius="sm" />
        ) : (
          <Text fz={30} fw={600} lh={1.1}>
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
    </Card>
  )
}
