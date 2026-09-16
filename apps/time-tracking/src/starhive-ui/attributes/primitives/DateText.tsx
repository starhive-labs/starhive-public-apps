import { Text } from '@mantine/core'

export type DateTextProps = {
  /** The raw ISO value, kept machine-readable in a `<time>` alongside the formatted one. */
  value: string
  formatted: string
}

export function DateText({ value, formatted }: DateTextProps) {
  return (
    <Text component="span" size="sm">
      <time dateTime={value}>{formatted}</time>
    </Text>
  )
}
