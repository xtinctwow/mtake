// LineButton.tsx
type Props = {
  onClick?: () => void
  ariaLabel?: string
  size?: "sm" | "md" | "lg"
}

export default function LineButton({
  onClick,
  ariaLabel = "Continue with LINE",
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
        "focus-visible:ring-2 focus-visible:ring-green-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
        sizes,
      ].join(" ")}
    >
      {/* inner inset card */}
      <span className="flex h-full w-full items-center justify-center rounded-xl">
        {/* LINE SVG */}
        <svg
          viewBox="0 0 97 96"
          className="h-6 w-6"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fill="#06C755"
            d="M48.125 96c26.51 0 48-21.49 48-48s-21.49-48-48-48-48 21.49-48 48 21.49 48 48 48"
          />
          <path
            fill="#fff"
            d="M80.165 45.23c0-14.334-14.394-26.018-32.04-26.018s-32.04 11.684-32.04 26.018c0 12.888 11.383 23.608 26.8 25.656 1.024.24 2.47.662 2.831 1.566.301.783.24 2.108.12 2.89 0 0-.36 2.29-.481 2.77-.12.784-.663 3.193 2.77 1.748s18.49-10.901 25.174-18.61c4.638-5.12 6.866-10.239 6.866-16.02"
          />
          <path
            fill="#06C755"
            d="M69.505 53.48a.603.603 0 0 0 .602-.602V50.59a.603.603 0 0 0-.602-.603h-6.143V47.64h6.143a.603.603 0 0 0 .602-.603v-2.288a.603.603 0 0 0-.602-.602h-6.143v-2.35h6.143a.603.603 0 0 0 .602-.602v-2.288a.603.603 0 0 0-.602-.602h-9.034a.604.604 0 0 0-.602.602v13.972c0 .362.301.602.602.602zm-33.365 0a.603.603 0 0 0 .602-.602V50.59a.603.603 0 0 0-.602-.603h-6.143V38.906a.603.603 0 0 0-.602-.602h-2.289a.604.604 0 0 0-.602.602v13.972c0 .362.301.602.602.602zm5.48-15.176h-2.288a.6.6 0 0 0-.602.602v14.032c0 .333.27.603.602.603h2.289c.332 0 .602-.27.602-.602V38.906a.6.6 0 0 0-.602-.602m15.478 0H54.81a.604.604 0 0 0-.602.602v8.311l-6.384-8.672v-.06h-2.289a.604.604 0 0 0-.602.602v13.972c0 .361.301.602.602.602h2.289a.603.603 0 0 0 .602-.602v-8.311l6.384 8.672.18.181h2.47a.604.604 0 0 0 .602-.602V39.026a.604.604 0 0 0-.602-.602z"
          />
        </svg>
      </span>
    </button>
  )
}
