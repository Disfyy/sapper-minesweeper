export function WrongFlagIcon(props: { className?: string }) {
  return (
    <svg
      className={props.className}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <polygon points="6,4 18,9 6,14" fill="#ea4335" opacity="0.7" />
      <rect x="5" y="4" width="2" height="16" fill="#202124" opacity="0.7" />
      <ellipse cx="12" cy="20" rx="5" ry="1.2" fill="#202124" opacity="0.7" />
      <line x1="3" y1="3" x2="21" y2="21" stroke="#d32f2f" strokeWidth="3" strokeLinecap="round" />
      <line x1="21" y1="3" x2="3" y2="21" stroke="#d32f2f" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
