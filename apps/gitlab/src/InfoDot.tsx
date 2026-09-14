import { ActionIcon, Tooltip } from "@mantine/core";
import type { ReactNode } from "react";

/**
 * A hint you can reach without acting on anything.
 *
 * An `ActionIcon` rather than a bare glyph so it takes keyboard focus: a tooltip that only opens on
 * hover is a tooltip half the people using this cannot read. The mark is drawn inline in
 * `currentColor` because this app ships no icon set, and one glyph is not a reason to add one.
 */
export function InfoDot({ label }: { label: ReactNode }) {
  return (
    <Tooltip
      label={label}
      multiline
      w={320}
      withArrow
      position="top-end"
      events={{ hover: true, focus: true, touch: true }}
    >
      <ActionIcon
        variant="subtle"
        color="gray"
        size="sm"
        aria-label="What can be linked"
      >
        <svg
          viewBox="0 0 16 16"
          width="15"
          height="15"
          aria-hidden="true"
          fill="none"
        >
          <circle
            cx="8"
            cy="8"
            r="6.25"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <circle cx="8" cy="5.1" r="0.85" fill="currentColor" />
          <path
            d="M8 7.4v4"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
      </ActionIcon>
    </Tooltip>
  );
}
