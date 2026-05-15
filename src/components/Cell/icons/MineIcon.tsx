import type { MineVariant } from '../../../cosmetics/types'

type MineIconProps = {
  className?: string
  variant?: MineVariant
}

export function MineIcon(props: MineIconProps) {
  const { className, variant = 'classic' } = props

  if (variant === 'pixel') {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        focusable="false"
      >
        <rect x="5" y="5" width="14" height="14" fill="#1a1a2e" />
        <rect x="7" y="7" width="4" height="4" fill="#e94560" />
        <rect x="13" y="7" width="4" height="4" fill="#e94560" />
        <rect x="7" y="13" width="4" height="4" fill="#e94560" />
        <rect x="13" y="13" width="4" height="4" fill="#0f3460" />
        <rect x="10" y="10" width="4" height="4" fill="#ffffff" />
      </svg>
    )
  }

  if (variant === 'gem') {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        focusable="false"
      >
        <polygon points="12,3 20,9 16,21 8,21 4,9" fill="#06b6d4" />
        <polygon points="12,3 16,21 8,21" fill="#0891b2" opacity="0.85" />
        <polygon points="12,3 20,9 4,9" fill="#22d3ee" opacity="0.7" />
        <polygon points="8,10 12,7 16,10 14,16 10,16" fill="#ecfeff" opacity="0.9" />
      </svg>
    )
  }

  if (variant === 'void') {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="12" cy="12" r="9" fill="#0b0b12" />
        <circle cx="12" cy="12" r="6.5" fill="#1e1035" />
        <circle cx="12" cy="12" r="3.5" fill="#7c3aed" />
        <circle cx="10" cy="10" r="1.2" fill="#c4b5fd" />
        <g stroke="#a855f7" strokeWidth="1.2">
          <line x1="12" y1="2" x2="12" y2="6" />
          <line x1="12" y1="18" x2="12" y2="22" />
          <line x1="2" y1="12" x2="6" y2="12" />
          <line x1="18" y1="12" x2="22" y2="12" />
        </g>
      </svg>
    )
  }

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="100%"
      height="100%"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="#202124">
        <rect x="11" y="2" width="2" height="4" />
        <rect x="11" y="18" width="2" height="4" />
        <rect x="2" y="11" width="4" height="2" />
        <rect x="18" y="11" width="4" height="2" />
        <rect x="4.6" y="4.6" width="2" height="4" transform="rotate(-45 5.6 6.6)" />
        <rect x="17.4" y="4.6" width="2" height="4" transform="rotate(45 18.4 6.6)" />
        <rect x="4.6" y="15.4" width="2" height="4" transform="rotate(45 5.6 17.4)" />
        <rect x="17.4" y="15.4" width="2" height="4" transform="rotate(-45 18.4 17.4)" />
      </g>
      <circle cx="12" cy="12" r="6.5" fill="#202124" />
      <rect x="9" y="9" width="2.2" height="2.2" fill="#ffffff" />
    </svg>
  )
}
