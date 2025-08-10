// GoogleButton.tsx
type Props = {
  onClick?: () => void
  ariaLabel?: string
  size?: "sm" | "md" | "lg"
}

export default function GoogleButton({
  onClick,
  ariaLabel = "Continue with Google",
  size = "md",
}: Props) {
  const sizes = {
    sm: "h-10 w-10 p-2",
    md: "h-12 w-12 p-2.5 [@media(min-width:768px)_and_(max-width:820px)]:h-10 [@media(min-width:768px)_and_(max-width:820px)]:w-10",
    lg: "h-14 w-14 p-3",
  }[size]

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={[
        "rounded group inline-flex items-center justify-center",
        "bg-slate-700/90 ring-1 ring-white/10 shadow-lg",
        "transition-all hover:bg-slate-600/90 hover:shadow-xl focus:outline-none",
        "focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
        sizes,
      ].join(" ")}
    >
      {/* inner inset card */}
      <span className="flex h-full w-full items-center justify-center rounded-xl">
        {/* Google SVG */}
        <svg
          viewBox="0 0 16 16"
          className="h-6 w-6"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fill="#4285f4"
            d="M15.68,8.18c0-.57-.05-1.11-.15-1.64h-7.53v3.09h4.31c-.19,1-.75,1.85-1.6,2.41v2.01h2.59c1.51-1.39,2.39-3.44,2.39-5.88Z"
          />
          <path
            fill="#34a853"
            d="M8,16c2.16,0,3.97-.72,5.29-1.94l-2.59-2.01c-.72.48-1.63.76-2.71.76-2.08,0-3.85-1.41-4.48-3.3H.85v2.07c1.32,2.61,4.02,4.41,7.15,4.41Z"
          />
          <path
            fill="#fbbc04"
            d="M3.52,9.52c-.16-.48-.25-.99-.25-1.52s.09-1.04.25-1.52v-2.07H.85c-.54,1.08-.85,2.3-.85,3.59s.31,2.51.85,3.59l2.67-2.07Z"
          />
          <path
            fill="#e94235"
            d="M8,3.18c1.17,0,2.23.4,3.06,1.2l2.29-2.29c-1.39-1.29-3.2-2.08-5.35-2.08C4.87,0,2.17,1.79.85,4.41l2.67,2.07c.63-1.89,2.39-3.3,4.48-3.3Z"
          />
        </svg>
      </span>
    </button>
  )
}
