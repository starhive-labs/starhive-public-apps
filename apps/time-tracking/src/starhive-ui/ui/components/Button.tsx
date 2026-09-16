// eslint-disable-next-line no-restricted-imports
import { Button as MantineButton, type ButtonProps as MantineButtonProps } from '@mantine/core'
import { forwardRef } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'transparent' | 'quiet'

export type ButtonProps = Omit<MantineButtonProps, 'variant' | 'color'> & {
  variant?: ButtonVariant
  type?: 'button' | 'submit' | 'reset'
  onClick?: React.MouseEventHandler<HTMLButtonElement>
}

const VARIANTS: Record<ButtonVariant, Pick<MantineButtonProps, 'variant' | 'color'>> = {
  primary: { variant: 'filled', color: 'primary' },
  secondary: { variant: 'default' },
  transparent: { variant: 'subtle', color: 'primary' },
  /*
   * A text button that is not an offer.
   *
   * `transparent` is the brand colour with no fill, which reads as "this is the thing to press" —
   * right for a disclosure, wrong for Refresh, Unlink and the rest of the small print, where a blue
   * word in a row of grey ones is the loudest thing on the panel. `neutral` takes ink instead: a
   * dark grey-blue on a light ground, a light one on a dark ground, from the same palette either way.
   */
  quiet: { variant: 'subtle', color: 'neutral' },
}

/*
 * The product's default button dimensions, which are not Mantine's.
 *
 * Mantine's `sm` is 36px tall with 18px of padding either side of the label; platform-ui's own
 * button is 32px with an effective 10px, and that is what a Starhive page looks like. Left to the
 * default, a button in an app is visibly chunkier than the same button one panel away — and in a
 * 380px drawer, two of them side by side stop fitting on a line.
 *
 * Written as Mantine's own variables so that everything derived from them — the loader, an icon
 * section's narrower padding — follows, which hardcoded padding would not.
 */
const DIMENSIONS = { root: { '--button-height': '32px', '--button-padding-x': '10px' } }

/**
 * Starhive button. `primary` (filled brand), `secondary` (outlined), `transparent` (subtle brand),
 * `quiet` (subtle ink — for actions that should not compete with the content).
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', radius = 'sm', size, ...props },
  ref,
) {
  return (
    <MantineButton
      ref={ref}
      radius={radius}
      size={size}
      /*
       * A default, not an override. Mantine merges `vars` from props *after* its own size resolver,
       * so setting these whatever the caller asked for would silently make `size` do nothing —
       * `size="compact-xs"` would come out the same 32px as everything else.
       */
      vars={size ? undefined : () => DIMENSIONS}
      {...VARIANTS[variant]}
      {...props}
    />
  )
})
