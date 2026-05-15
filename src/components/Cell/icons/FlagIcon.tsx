export function FlagIcon(props: { className?: string }) {
  return (
    <svg
      className={props.className}
      viewBox="0 0 24 24"
      width="100%"
      height="100%"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <polygon points="6,4 18,9 6,14" fill="#ea4335" />
      <rect x="5" y="4" width="2" height="16" fill="#202124" />
      <ellipse cx="12" cy="20" rx="5" ry="1.2" fill="#202124" />
    </svg>
  )
}
