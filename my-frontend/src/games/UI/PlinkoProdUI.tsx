import React from "react";
import { motion } from "framer-motion";
import { FaSync, FaDice, FaUndo } from "react-icons/fa"; // ← ikone

type Risk = "low" | "medium" | "high";
type Theme = {
  appBg: string; panel: string; panelSoft: string; border: string;
  text: string; subtext: string; accent: string; accentText: string;
  peg: string; ball: string;
};
type Ball = { id: string; pos: { x: number; y: number }; done: boolean; bornAt: number };

type Props = {
  theme: Theme;
  selectedCurrency: string;
  prices: { BTC?: number; SOL?: number } | null;

  betStr: string;
  setBetStr: React.Dispatch<React.SetStateAction<string>>;
  betError: string | null;
  betUsd: string;
  minBet: number;
  maxBet: number;

  risk: Risk;
  setRisk: React.Dispatch<React.SetStateAction<Risk>>;
  rows: number;
  setRows: React.Dispatch<React.SetStateAction<number>>;
  dropOne: () => void;

  showFair: boolean;
  setShowFair: React.Dispatch<React.SetStateAction<boolean>>;
  seeds: any;

  // ← NEW fairness actions
  onResetSeedsAll: () => void;
  onRandomizeClientSeed: () => void;
  onResetNonce: () => void;
  onClearReveals: () => void;

  boardWrapRef: React.RefObject<HTMLDivElement>;
  boardW: number;
  boardH: number;
  wrapW: number;
  hGap: number;
  vGap: number;
  pegPos: (r: number, i: number) => { x: number; y: number };
  slotPos: (i: number) => { x: number; y: number };

  balls: Ball[];
  results: number[];
  slots: number;
  table: number[];

  hoverSlot: number | null;
  setHoverSlot: React.Dispatch<React.SetStateAction<number | null>>;
  chancePct: (index: number) => number;

  colorForMultiplier: (m: number, table: number[], decimals?: number) => string;
  clamp: (n: number, mi: number, ma: number) => number;
  fmt8: (n: number) => string;
  ROWS_OPTIONS: readonly number[];
  landingSlot: number;
  landingPulse: number;
};

// Zamešaj dve RGB barvi (a=0..1): 0 = from, 1 = to
const mixRgb = (from: [number, number, number], to: [number, number, number], a = 0.5) => {
  const clamp = (x: number) => Math.max(0, Math.min(255, Math.round(x)));
  return [
    clamp(from[0] + (to[0] - from[0]) * a),
    clamp(from[1] + (to[1] - from[1]) * a),
    clamp(from[2] + (to[2] - from[2]) * a),
  ] as [number, number, number];
};

// "Temni" barvo tako, da jo zmiksaš proti črni (amount 0..1)
function darkenRgb([r, g, b]: [number, number, number], factor = 0.25): [number, number, number] {
  return [
    Math.max(0, Math.round(r * (1 - factor))),
    Math.max(0, Math.round(g * (1 - factor))),
    Math.max(0, Math.round(b * (1 - factor))),
  ];
}


export default function PlinkoProdUI({
  theme, selectedCurrency, prices,
  betStr, setBetStr, betError, betUsd, minBet, maxBet,
  risk, setRisk, rows, setRows, dropOne,
  showFair, setShowFair, seeds,
  onResetSeedsAll, onRandomizeClientSeed, onResetNonce, onClearReveals,
  boardWrapRef, boardW, boardH, wrapW, hGap, vGap, pegPos, slotPos,
  balls, results, slots, table,
  hoverSlot, setHoverSlot, chancePct,
  colorForMultiplier, clamp, fmt8, ROWS_OPTIONS, landingSlot, landingPulse,
}: Props) {
  return (
    <div className="w-full" style={{ backgroundColor: theme.appBg, color: theme.text }}>
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
          {/* LEFT PANEL */}
          <aside className="rounded-xl border h-fit" style={{ backgroundColor: theme.panel, borderColor: theme.border }}>
            <div className="p-4 md:p-5">
              <div className="flex bg-[#0b1a23] rounded-full p-1 mb-4 w-fit">
                <button className="px-4 py-1.5 text-sm rounded-full" style={{ backgroundColor: theme.panel, color: theme.text }}>
                  Manual
                </button>
                <button className="px-4 py-1.5 text-sm rounded-full text-[#7b8b97]">Auto</button>
              </div>

              {/* Bet */}
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs" style={{ color: theme.subtext }}>Bet Amount</div>
                <div className="text-xs" style={{ color: theme.subtext }}>{betUsd}</div>
              </div>

              <div className="flex flex-col gap-1.5">
                <div
                  className="flex items-center gap-2 rounded-lg px-2 py-2"
                  style={{
                    background: theme.panelSoft,
                    border: `1px solid ${betError ? "#ef4444" : theme.border}`,
                  }}
                >
                  <input
                    value={betStr}
                    onChange={(e) => setBetStr(e.target.value.replace(",", "."))}
                    className="flex-1 bg-transparent outline-none text-sm"
                    inputMode="decimal"
                    placeholder="0.00000000"
                  />
                  <div className="text-xs opacity-80">{selectedCurrency}</div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setBetStr(v => fmt8(Math.max(0, Number(v || "0") / 2)))}
                    className="px-3 py-2 rounded-lg text-sm"
                    style={{ background: "#223442", border: `1px solid ${theme.border}`, color: theme.text }}
                  >
                    ½
                  </button>
                  <button
                    onClick={() => setBetStr(v => fmt8(Math.min(maxBet, Number(v || "0") * 2)))}
                    className="px-3 py-2 rounded-lg text-sm"
                    style={{ background: "#223442", border: `1px solid ${theme.border}`, color: theme.text }}
                  >
                    2×
                  </button>
                </div>
              </div>

              {/* Risk & Rows */}
              <div className="mt-4">
                <div className="text-xs mb-1" style={{ color: theme.subtext }}>Risk</div>
                <select
                  value={risk}
                  onChange={(e) => setRisk(e.target.value as Risk)}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ background: theme.panelSoft, border: `1px solid ${theme.border}`, color: theme.text }}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div className="mt-3">
                <div className="text-xs mb-1" style={{ color: theme.subtext }}>Rows</div>
                <select
                  value={rows}
                  onChange={(e) => setRows(parseInt(e.target.value))}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ background: theme.panelSoft, border: `1px solid ${theme.border}`, color: theme.text }}
                >
                  {ROWS_OPTIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div className="mt-4">
                <button
                  onClick={dropOne}
                  className="w-full font-semibold rounded-lg py-3"
                  style={{ backgroundColor: theme.accent, color: theme.accentText }}
                >
                  Bet
                </button>
              </div>

              {/* Fairness toggle */}
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setShowFair((v) => !v)}
                  className="rounded-lg px-3 py-2 text-sm"
                  style={{ background: "#152532", border: `1px solid ${theme.border}`, color: theme.text }}
                >
                  Fairness
                </button>
              </div>

              {/* Fairness panel + akcije */}
              {showFair && (
                <div
                  className="mt-2 text-[11px] rounded-lg p-2"
                  style={{ background: "#0b1a23", border: `1px solid ${theme.border}`, color: theme.subtext }}
                >
                  {/* Akcijski gumbi (desno zgoraj) */}
                  <div className="flex items-center justify-end gap-1 mb-2">
                    <button
                      title="New client seed"
                      onClick={onRandomizeClientSeed}
                      className="p-1 rounded hover:opacity-80"
                      style={{ background: "#152532", border: `1px solid ${theme.border}`, color: theme.text }}
                    >
                      <FaDice />
                    </button>
                    <button
                      title="Reset all (new client seed, nonce=0, clear reveal/hash)"
                      onClick={onResetSeedsAll}
                      className="p-1 rounded hover:opacity-80"
                      style={{ background: "#152532", border: `1px solid ${theme.border}`, color: theme.text }}
                    >
                      <FaSync />
                    </button>
                  </div>

                  <div>Commitment: <span className="font-mono break-all">{(seeds as any).serverSeedHash || "—"}</span></div>
                  <div>Client seed: <span className="font-mono break-all">{(seeds as any).clientSeed || "—"}</span></div>
                  <div>Nonce: <span className="font-mono">{(seeds as any).nonce ?? "—"}</span></div>
                  {(seeds as any).serverSeed && (
                    <div>Reveal: <span className="font-mono break-all">{(seeds as any).serverSeed}</span></div>
                  )}

                  <div className="mt-2 opacity-60">
                    Note: Reset client seed with click on 🎲. Reset everything including hash and reveal with click on 🔁.
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* RIGHT: BOARD (brez sprememb prikaza) */}
          <div
            className="rounded-xl border relative overflow-hidden"
            style={{ backgroundColor: theme.panel, borderColor: theme.border, minHeight: 520 }}
          >
            <div ref={boardWrapRef} className="relative mx-auto w-full" style={{ maxWidth: 980 }}>
              <div className="relative mx-auto" style={{ width: boardW, height: boardH, marginTop: 12 }}>
                {/* pegs */}
                {Array.from({ length: rows }).map((_, r) => {
                  const cnt = r + 3;
                  return Array.from({ length: cnt }).map((__, i) => {
                    const p = pegPos(r, i);
                    const pegD = Math.max(14, Math.round(hGap * 0.22));
                    return (
                      <div
                        key={`${r}-${i}`}
                        className="absolute rounded-full"
                        style={{
                          left: p.x - pegD / 2,
                          top:  p.y - pegD / 2,
                          width: "14px",
                          height: "14px",
                          background: theme.peg,
                          boxShadow: "0 0 0 2px rgba(0,0,0,.18) inset",
                        }}
                      />
                    );
                  });
                })}

                {/* balls */}
                {balls.map((b) => {
                  const ballD = Math.max(16, Math.round(hGap * 0.38));
                  const r = ballD / 2;
                  return (
                    <motion.div
                      key={b.id}
                      className="absolute rounded-full"
                      animate={{ x: b.pos.x, y: b.pos.y, opacity: b.done ? 0.55 : 1 }}
                      transition={{ type: "spring", stiffness: 260, damping: 22 }}
                      style={{
                        width:  "16px",
                        height: "16px",
                        marginLeft: -r,
                        marginTop:  -r,
                        background: theme.ball,
                        boxShadow: "0 2px 8px rgba(0,0,0,.45)",
                        borderRadius: 999,
                      }}
                    />
                  );
                })}

                {/* bottom pockets */}
				{Array.from({ length: slots }).map((_, i) => {
				  const s  = slotPos(i);
				  const pw = Math.max(20, Math.min(38, hGap * 1.05));
				  const ph = Math.max(29, Math.min(35, vGap * 0.66));
				  const isHover = hoverSlot === i;

				  const mult = table[i]!;
				  const min  = Math.min(...table);
				  const max  = Math.max(...table);
				  const q    = Number(mult.toFixed(2));
				  const t    = (q - min) / Math.max(1e-12, max - min);

				  const from = [245, 197, 66] as [number, number, number];
				  const to   = [235,  38, 32] as [number, number, number];

				  const base   = from.map((f, k) => Math.round(f + (to[k] - f) * t)) as [number, number, number];
				  const bg     = `rgb(${base[0]}, ${base[1]}, ${base[2]})`;
				  const shade  = darkenRgb(base, 0.25);
				  const shadow = `rgba(${shade[0]}, ${shade[1]}, ${shade[2]}, 0.9)`;

				  const isLanding = landingSlot === i;
				  const pocketKey = isLanding ? `p-${i}-${landingPulse}` : `p-${i}`;

				  return (
					<div key={i}>
					  {/* STATIC CONTAINER (tekst ostane v overlay-u, ne animira se) */}
					  <div
						className="absolute rounded-md text-[11px] font-semibold flex items-center justify-center cursor-pointer"
						style={{
						  left: s.x - pw / 2,
						  top:  s.y - ph / 2,
						  width: pw,
						  height: ph,
						  lineHeight: 1,
						  color: "#111",
						  // med pristankom poskrbimo, da je nad žogico
						  zIndex: isLanding ? 50 : (isHover ? 11 : 1),
						  position: "absolute",
						  overflow: "visible",
						}}
						onMouseEnter={() => setHoverSlot(i)}
						onMouseLeave={() => setHoverSlot(cur => (cur === i ? null : cur))}
					  >
						{/* ANIMIRANO OZADJE */}
						<motion.div
						  key={pocketKey}
						  className="absolute inset-0 rounded-md border"
						  style={{
							borderColor: "rgb(166 0 4 / 0%)",
							background: bg,
							boxShadow: `0 .2em 3.2px 0 ${shadow}`,
							willChange: "transform",
							backfaceVisibility: "hidden",
						  }}
						  animate={
							isLanding
							  ? { y: [0, -8, 0], scale: [1, 1.06, 1] }
							  : { y: 0, scale: 1 }
						  }
						  transition={{ duration: 0.30, ease: [0.18, 0.89, 0.32, 1.28] }}
						/>

						{/* TEKST – NE ANIMIRA SE, ZATO NE IZGINE */}
						<span style={{ position: "relative", zIndex: 1 }}>
						  {mult.toFixed(mult >= 10 ? 0 : 2)}x
						</span>
					  </div>

					  {/* tooltip */}
					  {isHover && (() => {
						const tipW = Math.min(440, Math.max(340, wrapW * 0.6));
						const tipH = 74;
						const left = clamp(s.x - tipW / 2, 8, boardW - tipW - 8);
						const top  = s.y - ph / 2 - (tipH + 12);

						const profit    = Math.max(0, Number(betStr || "0") * (mult - 1));
						const profitStr = fmt8(profit);
						const usdPrice  = selectedCurrency === "BTC" ? prices?.BTC : prices?.SOL;
						const profitUsd = usdPrice ? `$${(profit * usdPrice).toFixed(2)}` : "$0.00";
						const chance    = chancePct(i);

						const arrowLeft = s.x - left - 8;
						const arrowLeftClamped = Math.max(12, Math.min(tipW - 12 - 16, arrowLeft));

						return (
						  <>
							<div
							  className="absolute rounded-lg"
							  style={{
								left, top, width: tipW, height: tipH,
								background: theme.panelSoft,
								border: `1px solid ${theme.border}`,
								boxShadow: "0 6px 18px rgba(0,0,0,.35)",
								zIndex: 12, padding: 10,
							  }}
							>
							  <div className="flex items-center justify-between text-[11px]" style={{ color: theme.subtext }}>
								<span>Profit on Win</span>
								<span>{profitUsd}</span>
							  </div>

							  <div className="mt-1 grid grid-cols-2 gap-2">
								<div className="rounded-md px-3 py-2 text-sm font-semibold flex items-center justify-between" style={{ background: "#223442", border: `1px solid ${theme.border}`, color: theme.text }}>
								  <span className="font-mono">{profitStr}</span>
								  <span className="opacity-80 text-xs ml-2">{selectedCurrency}</span>
								</div>

								<div className="rounded-md px-3 py-2 text-sm font-semibold flex items-center justify-between" style={{ background: "#223442", border: `1px solid ${theme.border}`, color: theme.text }}>
								  <span className="font-mono">{chance.toFixed(4)}</span>
								  <span className="opacity-80 text-xs ml-2">%</span>
								</div>
							  </div>
							</div>

							<div
							  className="absolute"
							  style={{
								left: left + arrowLeftClamped,
								top:  top + tipH - 1,
								width: 0, height: 0,
								borderLeft: "8px solid transparent",
								borderRight:"8px solid transparent",
								borderTop: `8px solid ${theme.panelSoft}`,
								zIndex: 12,
							  }}
							/>
						  </>
						);
					  })()}
					</div>
				  );
				})}
              </div>

              {/* Footer */}
              <div className="absolute left-4 bottom-4 text-xs" style={{ color: theme.subtext }}>
                Min {minBet} · Max {maxBet}
              </div>

              {/* Right column results */}
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <div className="flex flex-col gap-1 rounded-xl p-1" style={{ background: "#f4b400", boxShadow: "0 2px 0 rgba(0,0,0,.25) inset" }}>
                  {results.slice(0, 8).map((m, i) => (
                    <div key={i} className="min-w-[64px] text-center text-sm font-bold rounded-md px-3 py-1" style={{ background: "rgba(0,0,0,.08)", color: "#111", border: "1px solid rgba(0,0,0,.15)" }}>
                      {m.toFixed(m >= 10 ? 0 : 1)}×
                    </div>
                  ))}
                  {results.length === 0 && (
                    <div className="min-w-[64px] text-center text-sm font-bold rounded-md px-3 py-2 opacity-70" style={{ background: "rgba(0,0,0,.06)", color: "#111", border: "1px solid rgba(0,0,0,.15)" }}>
                      —
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          {/* /RIGHT */}
        </div>
      </div>
    </div>
  );
}
