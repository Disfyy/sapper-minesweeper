export function MineIcon(props: { className?: string }) {
  return (
    <svg
      className={props.className}
      viewBox="0 0 24 24"
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
