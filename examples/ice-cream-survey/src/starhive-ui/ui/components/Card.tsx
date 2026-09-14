import { Paper, type PaperProps } from '@mantine/core'
import { type ReactNode } from 'react'

export type CardProps = PaperProps & { children?: ReactNode }

/** Starhive surface card — bordered, rounded, soft shadow. */
export function Card({ children, ...props }: CardProps) {
  return (
    <Paper withBorder radius="lg" shadow="sm" p="md" {...props}>
      {children}
    </Paper>
  )
}
