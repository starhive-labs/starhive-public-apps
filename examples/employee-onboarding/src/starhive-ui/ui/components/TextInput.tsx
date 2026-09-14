// eslint-disable-next-line no-restricted-imports
import { TextInput as MantineTextInput, type TextInputProps } from '@mantine/core'
import { forwardRef } from 'react'

export type { TextInputProps }

/** Starhive text input (label, placeholder, error all supported via Mantine props). */
export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { radius = 'sm', ...props },
  ref,
) {
  return <MantineTextInput ref={ref} radius={radius} {...props} />
})
