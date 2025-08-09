// FacebookButton.tsx
type Props = {
  onClick?: () => void
  ariaLabel?: string
  size?: "sm" | "md" | "lg"
}

export default function FacebookButton({
  onClick,
  ariaLabel = "Continue with Facebook",
  size = "md",
}: Props) {
  const sizes = {
    sm: "h-10 w-10 p-2",
    md: "h-12 w-12 p-2.5",
    lg: "h-14 w-14 p-3",
  }[size]

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={[
        // outer tile
        "rounded group inline-flex items-center justify-center",
        "bg-slate-700/90 ring-1 ring-white/10 shadow-lg",
        "transition-all hover:bg-slate-600/90 hover:shadow-xl focus:outline-none",
        "focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
        sizes,
      ].join(" ")}
    >
      {/* inner inset card */}
      <span className="flex h-full w-full items-center justify-center rounded-xl">
        {/* Facebook SVG (from your code), sized and centered */}
        <svg
          viewBox="0 0 96 96"
          className="h-6 w-6 drop-shadow-sm"
          aria-hidden="true"
        >
          <path
            fill="#0866FF"
            d="M95.94 47.97C95.94 21.467 74.473 0 47.97 0S0 21.467 0 47.97c0 22.486 15.47 41.374 36.397 46.59v-31.9h-9.894V47.97h9.894v-6.296c0-16.31 7.376-23.925 23.446-23.925 3.058 0 8.274.6 10.433 1.2v13.31c-1.14-.12-3.118-.18-5.516-.18-7.856 0-10.914 3-10.914 10.734v5.157h15.65l-2.698 14.69H53.846v32.98C77.592 92.762 96 72.555 96 48.03z"
          />
          <path
            fill="#fff"
            d="m66.738 62.66 2.699-14.69h-15.65v-5.157c0-7.735 3.057-10.733 10.913-10.733 2.458 0 4.437 0 5.516.18V18.948c-2.158-.6-7.375-1.2-10.433-1.2-16.01 0-23.446 7.556-23.446 23.926v6.296h-9.894v14.69h9.894v31.9c3.718.9 7.615 1.44 11.573 1.44a47 47 0 0 0 5.816-.36V62.66z"
          />
        </svg>
      </span>
    </button>
  )
}
