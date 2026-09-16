// eslint-disable-next-line no-restricted-imports
import { Select as MantineSelect, type SelectProps } from '@mantine/core'
import { forwardRef } from 'react'

export type { SelectProps }

/** Starhive select dropdown (pass `data`, `value`, `onChange` per Mantine's Select). */
export const Select = forwardRef<HTMLInputElement, SelectProps>(function Select(
  { radius = 'sm', ...props },
  ref,
) {
  return <MantineSelect ref={ref} radius={radius} {...props} />
})
