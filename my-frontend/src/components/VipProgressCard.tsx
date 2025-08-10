// VipProgressCard.tsx
import React from "react";

type Level = "Bronze" | "Silver" | "Gold" | string;

type Props = {
  username: string;
  level: Level;                 // current VIP level
  wager: number;                // current wager toward next level
  nextLevelTarget: number;      // wager needed to reach next level
  isFavorite?: boolean;
};

const GOLD = "#C69C6D";

export default function VipProgressCard({
  username,
  level,
  wager,
  nextLevelTarget,
  isFavorite = false,
}: Props) {
  const pct = Math.max(0, Math.min(100, (wager / nextLevelTarget) * 100));

  return (
    <div
      className="rounded-lg bg-[#0E2532] text-white p-5 shadow-sm"
      style={{ border: `2px solid ${GOLD}` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="font-semibold text-lg leading-tight">{username}</div>
        {/* star icon */}
        <button
          aria-label={isFavorite ? "Unfavorite" : "Favorite"}
          className="shrink-0"
        >
          <StarIcon filled={isFavorite} color={GOLD} className="w-5 h-5" />
        </button>
      </div>

      {/* Progress row */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 font-semibold">
          <span>Your VIP Progress</span>
          <ArrowRightIcon className="w-4 h-4" />
        </div>

        <div className="flex items-center gap-2">
          <span className="font-semibold">{pct.toFixed(2)}%</span>
          <InfoIcon className="w-4 h-4 opacity-70" />
        </div>
      </div>

      {/* Progress bar */}
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Number(pct.toFixed(2))}
        className="relative w-full h-2.5 rounded-full bg-[#243A49] overflow-hidden mb-4"
      >
        <div
          className="h-full rounded-full shadow"
          style={{ width: `${pct}%`, backgroundColor: GOLD }}
        />
      </div>

      {/* Milestones */}
      <div className="flex items-center justify-between">
        <Milestone label="Bronze" active={level === "Bronze"} />
        <Milestone label="Silver" active={level === "Silver"} />
      </div>

      {/* Optional helper text (wager numbers) */}
      <div className="mt-3 text-xs text-white/70">
        Wagered {formatNum(wager)} / {formatNum(nextLevelTarget)}
      </div>
    </div>
  );
}

/* ---- Small subcomponents (inline SVGs, no deps) ---- */

function StarIcon({
  filled,
  color = "currentColor",
  className = "w-4 h-4",
}: { filled?: boolean; color?: string; className?: string }) {
  return filled ? (
    <svg viewBox="0 0 24 24" className={className} style={{ color }}>
      <path
        fill="currentColor"
        d="m12 17.27 6.18 3.73-1.64-7.03L21.5 9.5l-7.19-.61L12 2 9.69 8.89 2.5 9.5l4.96 4.47L5.82 21z"
      />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className={className} style={{ color }}>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        d="m12 17.27 6.18 3.73-1.64-7.03L21.5 9.5l-7.19-.61L12 2 9.69 8.89 2.5 9.5l4.96 4.47L5.82 21z"
      />
    </svg>
  );
}

function ArrowRightIcon({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 64 64" className={className}>
      <path fill="currentColor" d="M8 37.5h30.9L28.7 47.7l6.3 6.3L56 33 35 12l-6.3 6.3L38.9 28H8z" />
    </svg>
  );
}

function InfoIcon({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 64 64" className={className}>
      <path
        fill="currentColor"
        d="M32 0C14.3 0 0 14.3 0 32s14.3 32 32 32 32-14.3 32-32S49.7 0 32 0zm5.2 51.7H26.8v-21h10.4zM32 24.6a6.1 6.1 0 1 1 6.1-6.1A6.09 6.09 0 0 1 32 24.6z"
      />
    </svg>
  );
}

function Milestone({ label, active }: { label: string; active?: boolean }) {
  const color = active ? GOLD : "rgba(178, 204, 204, 0.9)"; // match screenshot tones
  return (
    <div className="flex items-center gap-2">
      <StarIcon color={color} />
      <span
        className={`font-semibold ${active ? "" : "text-white/70"}`}
        style={{ color: active ? color : undefined }}
      >
        {label}
      </span>
    </div>
  );
}

/* ---- helpers ---- */
function formatNum(n: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
}
