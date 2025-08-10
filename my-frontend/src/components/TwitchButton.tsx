// TwitchButton.tsx
type Props = {
  onClick?: () => void
  ariaLabel?: string
  size?: "sm" | "md" | "lg"
}

export default function TwitchButton({
  onClick,
  ariaLabel = "Continue with Twitch",
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
        "focus-visible:ring-2 focus-visible:ring-purple-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
        sizes,
      ].join(" ")}
    >
      {/* inner inset card */}
      <span className="flex h-full w-full items-center justify-center rounded-xl">
        {/* Twitch SVG */}
        <svg
          viewBox="0 0 96 96"
          className="h-6 w-6"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fill="#fff"
            d="M82.378 44.593 68.69 58.281H55.002L42.987 70.297V58.28H27.565V6.875h54.813z"
          />
          <path
            fill="#9146FF"
            d="M24.156 0 7 17.156v61.688h20.563V96l17.156-17.156h13.688L89.25 48V0zm58.222 44.593L68.69 58.281H55.002L42.987 70.297V58.28H27.565V6.875h54.813z"
          />
          <path
            fill="#9146FF"
            d="M72.156 18.89h-6.875v20.563h6.875zm-18.89 0H46.39v20.563h6.875z"
          />
        </svg>
      </span>
    </button>
  )
}
