// src/games/PlinkoProdUI.tsx
import React from "react";
import { motion } from "framer-motion";

type Risk = "low" | "medium" | "high";

type Theme = {
  appBg: string; panel: string; panelSoft: string; border: string;
  text: string; subtext: string; accent: string; accentText: string;
  peg: string; ball: string;
};

type Ball = { id: string; pos: { x: number; y: number }; done: boolean; bornAt: number };

type Props = {
  /* theming & currency */
  theme: Theme;
  selectedCurrency: string;
  prices: { BTC?: number; SOL?: number } | null;

  /* bet controls */
  betStr: string;
  setBetStr: React.Dispatch<React.SetStateAction<string>>;
  betUsd: string;
  minBet: number;
  maxBet: number;

  /* game controls */
  risk: Risk;
  setRisk: React.Dispatch<React.SetStateAction<Risk>>;
  rows: number;
  setRows: React.Dispatch<React.SetStateAction<number>>;
  dropOne: () => void;

  /* fairness */
  showFair: boolean;
  setShowFair: React.Dispatch<React.SetStateAction<boolean>>;
  seeds: any;

  /* board sizing/geometry */
  boardWrapRef: React.RefObject<HTMLDivElement>;
  boardW: number;
  boardH: number;
  wrapW: number;
  hGap: number;
  vGap: number;
  pegPos: (r: number, i: number) => { x: number; y: number };
  slotPos: (i: number) => { x: number; y: number };

  /* state for drawing */
  balls: Ball[];
  results: number[];
  slots: number;
  table: number[];

  /* hover/tooltip */
  hoverSlot: number | null;
  setHoverSlot: React.Dispatch<React.SetStateAction<number | null>>;
  chancePct: (index: number) => number;

  /* utils */
  colorForMultiplier: (m: number, table: number[], decimals?: number) => string;
  clamp: (n: number, mi: number, ma: number) => number;
  fmt8: (n: number) => string;
  ROWS_OPTIONS: readonly number[];
};

export default function PlinkoProdUI({
  theme, selectedCurrency, prices,
  betStr, setBetStr, betUsd, minBet, maxBet,
  risk, setRisk, rows, setRows, dropOne,
  showFair, setShowFair, seeds,
  boardWrapRef, boardW, boardH, wrapW, hGap, vGap, pegPos, slotPos,
  balls, results, slots, table,
  hoverSlot, setHoverSlot, chancePct,
  colorForMultiplier, clamp, fmt8, ROWS_OPTIONS,
}: Props) {
  return (
    <div className="w-full" style={{ backgroundColor: theme.appBg, color: theme.text }}>
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
          {/* LEFT PANEL */}
          <aside
            className="rounded-xl border h-fit"
            style={{ backgroundColor: theme.panel, borderColor: theme.border }}
          >
            <div className="p-4 md:p-5">
              <div className="flex bg-[#0b1a23] rounded-full p-1 mb-4 w-fit">
                <button
                  className="px-4 py-1.5 text-sm rounded-full"
                  style={{ backgroundColor: theme.panel, color: theme.text }}
                >
                  Manual
                </button>
                <button className="px-4 py-1.5 text-sm rounded-full text-[#7b8b97]">Auto</button>
              </div>

              {/* Bet */}
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs" style={{ color: theme.subtext }}>Bet Amount</div>
                <div className="text-xs" style={{ color: theme.subtext }}>{betUsd}</div>
              </div>
              <div className="flex gap-2">
                <div
                  className="flex-1 flex items-center gap-2 rounded-lg px-2 py-2"
                  style={{ background: theme.panelSoft, border: `1px solid ${theme.border}` }}
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

              {/* Fairness */}
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setShowFair((v) => !v)}
                  className="rounded-lg px-3 py-2 text-sm"
                  style={{ background: "#152532", border: `1px solid ${theme.border}`, color: theme.text }}
                >
                  Fairness
                </button>
              </div>
              {showFair && (
                <div
                  className="mt-2 text-[11px] space-y-1 rounded-lg p-2"
                  style={{ background: "#0b1a23", border: `1px solid ${theme.border}`, color: theme.subtext }}
                >
                  <div>Commitment: <span className="font-mono break-all">{(seeds as any).serverSeedHash || "—"}</span></div>
                  <div>Client seed: <span className="font-mono break-all">{(seeds as any).clientSeed || "—"}</span></div>
                  <div>Nonce: <span className="font-mono">{(seeds as any).nonce ?? "—"}</span></div>
                  {(seeds as any).serverSeed && (
                    <div>Reveal: <span className="font-mono break-all">{(seeds as any).serverSeed}</span></div>
                  )}
                </div>
              )}
            </div>
          </aside>

          {/* RIGHT: BOARD */}
          <div
            className="rounded-xl border relative overflow-hidden"
            style={{ backgroundColor: theme.panel, borderColor: theme.border, minHeight: 520 }}
          >
            <div ref={boardWrapRef} className="relative mx-auto w-full" style={{ maxWidth: 980 }}>
              <div className="relative mx-auto" style={{ width: boardW, height: boardH, marginTop: 12 }}>
                {/* pegs — 1. vrstica 3, 2. vrstica 4, nato 5, 6, ... */}
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
                          width: pegD,
                          height: pegD,
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
                        width:  ballD,
                        height: ballD,
                        marginLeft: -r,
                        marginTop:  -r,
                        background: theme.ball,
                        boxShadow: "0 2px 8px rgba(0,0,0,.45)",
                        borderRadius: 999,
                      }}
                    />
                  );
                })}

                {/* bottom pockets — točno med peg-i zadnje vrstice (rows+2 pegov) */}
                {Array.from({ length: slots }).map((_, i) => {
                  const s  = slotPos(i);
                  const pw = Math.max(38, Math.min(56, hGap * 1.05));
                  const ph = Math.max(22, Math.min(28, vGap * 0.66));
                  const isHover = hoverSlot === i;

                  const mult = table[i]!;
                  const bg   = colorForMultiplier(mult, table, 2);

                  return (
                    <div key={i}>
                      {/* Pocket cell */}
                      <div
                        className="absolute rounded-md border text-[11px] font-semibold flex items-center justify-center cursor-pointer"
                        style={{
                          left: s.x - pw / 2,
                          top:  s.y - ph / 2,
                          width: pw,
                          height: ph,
                          borderColor: theme.border,
                          background: bg,
                          color: "#111",
                          boxShadow: "0 1px 0 rgba(0,0,0,.15) inset",
                          lineHeight: 1,
                          zIndex: isHover ? 11 : 1,
                        }}
                        onMouseEnter={() => setHoverSlot(i)}
                        onMouseLeave={() => setHoverSlot(cur => (cur === i ? null : cur))}
                      >
                        {mult.toFixed(mult >= 10 ? 0 : 2)}x
                      </div>

                      {/* Tooltip on hover */}
                      {isHover && (() => {
                        const tipW = Math.min(440, Math.max(340, wrapW * 0.6));
                        const tipH = 74;
                        const left = clamp(s.x - tipW / 2, 8, boardW - tipW - 8);
                        const top  = s.y - ph / 2 - (tipH + 12);

                        const profit = Math.max(0, Number(betStr || "0") * (mult - 1));
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
                                <div
                                  className="rounded-md px-3 py-2 text-sm font-semibold flex items-center justify-between"
                                  style={{ background: "#223442", border: `1px solid ${theme.border}`, color: theme.text }}
                                >
                                  <span className="font-mono">{profitStr}</span>
                                  <span className="opacity-80 text-xs ml-2">{selectedCurrency}</span>
                                </div>

                                <div
                                  className="rounded-md px-3 py-2 text-sm font-semibold flex items-center justify-between"
                                  style={{ background: "#223442", border: `1px solid ${theme.border}`, color: theme.text }}
                                >
                                  <span className="font-mono">{chance.toFixed(4)}</span>
                                  <span className="opacity-80 text-xs ml-2">%</span>
                                </div>
                              </div>
                            </div>

                            {/* Arrow */}
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
                <div
                  className="flex flex-col gap-1 rounded-xl p-1"
                  style={{ background: "#f4b400", boxShadow: "0 2px 0 rgba(0,0,0,.25) inset" }}
                >
                  {results.slice(0, 8).map((m, i) => (
                    <div
                      key={i}
                      className="min-w-[64px] text-center text-sm font-bold rounded-md px-3 py-1"
                      style={{ background: "rgba(0,0,0,.08)", color: "#111", border: "1px solid rgba(0,0,0,.15)" }}
                    >
                      {m.toFixed(m >= 10 ? 0 : 1)}×
                    </div>
                  ))}
                  {results.length === 0 && (
                    <div
                      className="min-w-[64px] text-center text-sm font-bold rounded-md px-3 py-2 opacity-70"
                      style={{ background: "rgba(0,0,0,.06)", color: "#111", border: "1px solid rgba(0,0,0,.15)" }}
                    >
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
