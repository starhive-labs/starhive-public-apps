/**
 * How much room the board gets, and whether the move list fits beside it.
 *
 * Its own module with no React in it, because this is the kind of arithmetic that is quietly wrong
 * by forty pixels for a month — and a pure function can be checked.
 */

/** The move list's column. */
export const PANEL = 240
export const GAP = 16
/** Below this container width, the move list goes under the board instead of beside it. */
export const SIDE_BY_SIDE_AT = 620
/** Room for the heading, the buttons and the page's own padding. */
export const CHROME = 190
export const MIN_BOARD = 240

export type BoardLayout = { size: number; sideBySide: boolean }

/**
 * Bounded by three things at once, and the smallest wins: the width this component was given, the
 * height of the window, and what the slot thinks is reasonable.
 *
 * Width alone is not enough — a board sized purely by width overflows the bottom of the page on a
 * laptop, and you scroll to see your own back rank.
 */
export function boardLayout(
  containerWidth: number,
  viewportHeight: number,
  max: number,
): BoardLayout {
  const sideBySide = containerWidth >= SIDE_BY_SIDE_AT
  const forBoard = sideBySide ? containerWidth - PANEL - GAP : containerWidth
  // `containerWidth` is 0 on the first paint, before the observer has measured anything. Falling
  // back to `max` there means the board appears at its intended size rather than at the minimum and
  // then jumping.
  const size = Math.max(MIN_BOARD, Math.min(max, forBoard || max, viewportHeight - CHROME))
  return { size, sideBySide }
}

/**
 * Where a scrolling list should sit so that one row is visible.
 *
 * Takes viewport and row edges in the same coordinate space — viewport coordinates, from
 * `getBoundingClientRect`, rather than `offsetTop`, whose meaning depends on which ancestor happens
 * to be positioned. Returns the new `scrollTop`, unchanged when the row is already in view, so
 * stepping through the middle of a visible list does not jump.
 */
export function keepInView(
  view: { top: number; bottom: number },
  row: { top: number; bottom: number },
  scrollTop: number,
): number {
  // Above the fold: bring its top to the top.
  if (row.top < view.top) return Math.max(0, scrollTop + (row.top - view.top))
  // Below it: bring its bottom to the bottom. A row taller than the viewport falls out of the first
  // branch on the next pass, which is the right answer — show its start.
  if (row.bottom > view.bottom) return Math.max(0, scrollTop + (row.bottom - view.bottom))
  return scrollTop
}
