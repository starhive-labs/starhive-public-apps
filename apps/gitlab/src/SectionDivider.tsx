import { Divider, Text } from "@mantine/core";

/**
 * A section's name, with its rule running out to the right of it.
 *
 * The heading and the rule are the same object rather than a label with a line under it somewhere:
 * the line is what says "a new section starts here", and a rule with nothing attached says only
 * "something changed" and leaves the reader to work out what.
 */
export function SectionDivider({ label }: { label: string }) {
  return (
    <Divider
      labelPosition="left"
      label={
        <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts="0.04em">
          {label}
        </Text>
      }
    />
  );
}
