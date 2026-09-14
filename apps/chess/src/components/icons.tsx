/**
 * The two icons the app needs, drawn inline.
 *
 * No icon package: the bundle CSP allows no external resource of any kind, so anything not in the
 * bundle simply does not load — and pulling a whole icon library in for two glyphs is a poor trade
 * against a page that already ships half a megabyte. `currentColor` so they take the theme's ink.
 */
type IconProps = { size?: number }

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
})

export function PersonIcon({ size = 32 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
    </svg>
  )
}

export function ComputerIcon({ size = 32 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="2" y="4" width="20" height="13" rx="2" />
      <path d="M9 21h6M12 17v4" />
    </svg>
  )
}

export function BoardIcon({ size = 32 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    </svg>
  )
}

export function HistoryIcon({ size = 32 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v4h4" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}
