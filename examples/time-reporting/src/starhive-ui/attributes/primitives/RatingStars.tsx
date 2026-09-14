import { Rating, Tooltip } from '@mantine/core'

/**
 * A read-only star rating. Mantine's Rating is already what the product uses, so this only fixes the
 * read-only-ness and the half-star fractions from the attribute's configuration.
 */
export function RatingStars({
  value,
  maxRating = 5,
  allowHalfValues = false,
}: {
  value: string
  maxRating?: number
  allowHalfValues?: boolean
}) {
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed)) return null

  const label = `Rating ${parsed} out of ${maxRating}`

  return (
    <Tooltip label={label} withArrow position="top">
      {/* The stars are decorative once the value is announced here — a screen reader hearing
          "3 out of 5" is better served than by five unlabelled radio inputs. */}
      <div
        role="img"
        aria-label={label}
        style={{ position: 'relative', zIndex: 0, display: 'inline-flex' }}
      >
        <Rating
          value={parsed}
          count={maxRating}
          fractions={allowHalfValues ? 2 : 1}
          readOnly
          size="sm"
        />
      </div>
    </Tooltip>
  )
}
