// Added fairness verification state and link

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RxDragHandleVertical } from "react-icons/rx";
import { FiRefreshCw } from "react-icons/fi";

/**
 * Dice (Stake-style)
 * - Thumb-only drag (integer steps), inputs allow decimals
 * - Threshold clamped to 2..98 (labels still 0..100)
 * - Top recent results pills (green win / gray loss)
 * - No top mode buttons; middle box toggles Over/Under (read-only)
 * - Labels centered using same geometry as track
 */

// ---------- Limits ----------
const MIN_T = 2;
const MAX_T = 98;
const clamp = (n: number, a: number, b: number) => Math.min(Math.max(n, a), b);
const clampRange = (v: number) => clamp(v, MIN_T, MAX_T);              // decimals allowed
const clampRangeInt = (v: number) => Math.round(clamp(v, MIN_T, MAX_T)); // integer for dragging

// ---------- Geometry helpers ----------
const xFromPercent = (p: number, innerW: number, sidePad: number) =>
  sidePad + (innerW * clamp(p, 0, 100)) / 100;

const percentFromClientX = (clientX: number, rect: DOMRect, sidePad: number) => {
  const usable = Math.max(1, rect.width - 2 * sidePad);
  const xRaw = clientX - rect.left - sidePad;
  const x = clamp(xRaw, 0, usable);
  return (x / usable) * 100;
};

// ---------- Crypto helpers ----------
async function hmacSHA256(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return bufferToHex(sig);
}
function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function hexToFloat01(hex: string): number {
  const slice = hex.slice(0, 13);
  const int = parseInt(slice, 16);
  const max = Math.pow(16, slice.length);
  return int / max; // [0,1)
}
async function* seededRandoms({ serverSeed, clientSeed, nonce }: { serverSeed: string; clientSeed: string; nonce: number; }) {
  let cursor = 0;
  while (true) {
    const msg = `${serverSeed}:${clientSeed}:${nonce}:${cursor++}`;
    const hex = await hmacSHA256(serverSeed, msg);
    yield hexToFloat01(hex);
  }
}
async function nextRoll100(seeds: { serverSeed: string; clientSeed: string; nonce: number; }): Promise<number> {
  const gen = seededRandoms(seeds);
  const { value: r } = await gen.next();
  return Math.floor((r as number) * 10000) / 100; // 0.00–99.99
}

// ---------- Math helpers ----------
function to2(x: number) { return Number(x.toFixed(2)); }
function winChanceFromMultiplier(mult: number, houseEdge: number) {
  const chance = (100 * (1 - houseEdge)) / mult;
  return clamp(chance, 0.01, 99.99);
}
function multiplierFromWinChance(chance: number, houseEdge: number) {
  const mult = (100 / chance) * (1 - houseEdge);
  return Math.max(1.0001, mult);
}
function profitOnWin(bet: number, mult: number) { return Math.max(0, bet * mult - bet); }

// ---------- Defaults - PRODUCTION! ----------
const DEFAULT_SEEDS = {
  serverSeed: "DEMO_SERVER_SEED_DO_NOT_USE_IN_PROD",
  clientSeed: "client-1",
  nonce: 1,
};

type ResultItem = { v: number; win: boolean };

export default function DiceGame({
  houseEdge = 0.01,
  minBet = 0.00000000,
  maxBet = 1000,
  currency = "USD",
  onPlaceBet,
  onResolve,
}: {
  houseEdge?: number;
  minBet?: number;
  maxBet?: number;
  currency?: string;
  onPlaceBet?: (bet: number, params: { mode: "over" | "under"; chance: number; }, seeds: typeof DEFAULT_SEEDS) => Promise<{ roundId?: string; serverSeedHash?: string } | void>;
  onResolve?: (roundId: string) => Promise<{ serverSeed: string } | void>;
}) {
  // Skin
  const c = useMemo(() => ({
    appBg: "#0f212e",
    panel: "#1a2c38",
    panelSoft: "#152532",
    border: "#2a4152",
    text: "#d7e1ea",
    subtext: "#91a3b0",
    accent: "#00e701",
    accentText: "#001b0a",
    red: "#ff5757",
    green: "#00d463",
    grayPill: "#2d3f4d",
    sliderTrack: "#2a4152",
	labelTrack: "#ffffff",
    sliderBg: "#0e1d26",
    thumb: "#5b9cff",
  }), []);

  // ----- State -----
  const [bet, setBet] = useState<number>(0);

  const [mode, setMode] = useState<"over" | "under">("under");
  // Threshold can be decimal via inputs (drag snaps to integer)
  const [threshold, setThreshold] = useState<number>(50);

  const chance = useMemo(() => to2(mode === "under" ? threshold : 100 - threshold), [threshold, mode]);
  const [mult, setMult] = useState<number>(() => multiplierFromWinChance(50, houseEdge));

  // Inputs
  const [chanceField, setChanceField] = useState<string>(chance.toFixed(2));
  const [editingChance, setEditingChance] = useState<boolean>(false);
  const [multField, setMultField] = useState<string>(mult.toFixed(4));
  const [editingMult, setEditingMult] = useState<boolean>(false);

  const [seeds, setSeeds] = useState(DEFAULT_SEEDS);
  const [serverSeedHash, setServerSeedHash] = useState<string>("");
  const [roundId, setRoundId] = useState<string | null>(null);

  const [rolling, setRolling] = useState<boolean>(false);
  const [result, setResult] = useState<number | null>(null);
  const [win, setWin] = useState<boolean | null>(null);
  const [lastRoll, setLastRoll] = useState<number | null>(null);
  const [lastWin, setLastWin] = useState<boolean | null>(null);
  
  const [showMarker, setShowMarker] = useState(false);
  const markerTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Recent results pills
  const [recent, setRecent] = useState<ResultItem[]>([]); // newest first

  // Track geometry
  const barRef = useRef<HTMLDivElement | null>(null);
  const [barW, setBarW] = useState(0);
  const THUMB = 32;            // px
  const BORDER_W = 14;          // px
  const SIDE_PAD = THUMB / 2 + BORDER_W;

  useLayoutEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setBarW(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const innerWidth = Math.max(0, barW - 2 * SIDE_PAD);
  const thumbLeftPx = xFromPercent(threshold, innerWidth, SIDE_PAD);

  const profit = useMemo(() => profitOnWin(bet, mult), [bet, mult]);

  // Sync fields when not editing
  useEffect(() => { if (!editingChance) setChanceField(chance.toFixed(2)); }, [chance, editingChance]);
  useEffect(() => { if (!editingMult) setMultField(mult.toFixed(4)); }, [mult, editingMult]);
  useEffect(() => { setMult(multiplierFromWinChance(chance, houseEdge)); }, [chance, houseEdge]);

  // Gradient (Under: green→red; Over: red→green)
  const trackGradient = useMemo(() => {
    if (mode === "under") {
      return `linear-gradient(to right, ${c.green} 0%, ${c.green} ${threshold}%, ${c.red} ${threshold}%, ${c.red} 100%)`;
    } else {
      return `linear-gradient(to right, ${c.red} 0%, ${c.red} ${threshold}%, ${c.green} ${threshold}%, ${c.green} 100%)`;
    }
  }, [mode, threshold, c.green, c.red]);

  // ----- Actions -----
  function stepBet(factor: number) {
    setBet((b) => Math.min(Math.max(Number((b * factor).toFixed(8)), minBet), maxBet));
  }

  function toggleMode() {
    setMode((m) => (m === "under" ? "over" : "under"));
  }

async function startRound() {
    if (bet < minBet || bet > maxBet) return alert(`Bet must be between ${minBet} and ${maxBet}.`);

    const newSeeds = { ...seeds, nonce: Number(seeds.nonce) || 1 };
    setSeeds(newSeeds);

    let rid: string | null = null, hash = "";
    if (onPlaceBet) {
      try {
        const resp = await onPlaceBet(bet, { mode, chance }, newSeeds);
        rid = resp?.roundId ?? null;
        hash = resp?.serverSeedHash ?? "";
      } catch (e) { console.warn("onPlaceBet failed; demo mode.", e); }
    } else {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(newSeeds.serverSeed));
      hash = bufferToHex(digest);
    }
    setRoundId(rid);
    setServerSeedHash(hash);

    setRolling(true);
    const roll = await nextRoll100(newSeeds);
    const didWin = mode === "under" ? roll < threshold : roll > threshold;
    await new Promise((r) => setTimeout(r, 350));
    setResult(roll); setWin(didWin); setRolling(false);
	// Show marker and reset its hide timer
	setShowMarker(true);
	if (markerTimerRef.current) {
	  clearTimeout(markerTimerRef.current);
	}
	markerTimerRef.current = setTimeout(() => {
	  setShowMarker(false);
	}, 3000);

    setLastRoll(roll); setLastWin(didWin);
    // update recent pills (newest first), cap to 14 like Stake-ish
    setRecent((prev) => [{ v: roll, win: didWin }, ...prev].slice(0, 14));

    if (onResolve && rid) { try { await onResolve(rid); } catch {} }
  }

  // Thumb-only dragging (snap to 1; still 2..98)
  function beginDrag(e: React.PointerEvent) {
    e.preventDefault();
    const move = (ev: PointerEvent) => {
      if (!barRef.current) return;
      const rect = barRef.current.getBoundingClientRect();
      const pct = percentFromClientX(ev.clientX, rect, SIDE_PAD);
      setThreshold(clampRangeInt(pct)); // integer step
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <div className="w-full" style={{ backgroundColor: c.appBg, color: c.text }}>
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-4">
        
        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4 md:gap-6">
          {/* LEFT PANEL */}
          <aside className="rounded-xl border h-fit" style={{ backgroundColor: c.panel, borderColor: c.border }}>
            <div className="p-4 md:p-5">
              <label className="text-xs" style={{ color: c.subtext }}>Bet Amount</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="number"
                  min={minBet}
                  max={maxBet}
                  step="0.00000001"
                  value={bet}
                  onChange={(e) => setBet(Number(e.target.value))}
                  className="flex-1 rounded-lg px-3 py-2 outline-none text-sm"
                  style={{ backgroundColor: c.panelSoft, borderColor: c.border, borderWidth: 1 }}
                />
                <div className="flex gap-1">
                  <button onClick={() => stepBet(0.5)} className="px-2 py-2 rounded-lg text-sm" style={{ backgroundColor: c.panelSoft, borderColor: c.border, borderWidth: 1 }}>½</button>
                  <button onClick={() => stepBet(2)} className="px-2 py-2 rounded-lg text-sm" style={{ backgroundColor: c.panelSoft, borderColor: c.border, borderWidth: 1 }}>2×</button>
                </div>
              </div>

              <div className="mt-3">
                <label className="text-xs" style={{ color: c.subtext }}>Profit on Win</label>
                <div className="mt-1 flex items-center gap-2">
                  <input disabled value={profit.toFixed(8)} className="flex-1 rounded-lg px-3 py-2 outline-none text-sm" style={{ backgroundColor: c.panelSoft, borderColor: c.border, borderWidth: 1 }} />
                </div>
              </div>

              <div className="mt-4">
                <button onClick={startRound} disabled={rolling} className="w-full font-semibold rounded-lg py-3 disabled:opacity-60" style={{ backgroundColor: c.accent, color: c.accentText }}>
                  {rolling ? "Rolling…" : "Bet"}
                </button>
              </div>

              {/* Seeds */}
              <div className="mt-4 grid grid-cols-1 gap-3">
                <div>
                  <label className="text-xs" style={{ color: c.subtext }}>Client seed</label>
                  <input type="text" value={seeds.clientSeed} onChange={(e) => setSeeds((s) => ({ ...s, clientSeed: e.target.value }))} className="mt-1 w-full rounded-lg px-3 py-2 outline-none text-sm" style={{ backgroundColor: c.panelSoft, borderColor: c.border, borderWidth: 1 }} />
                </div>
                <div>
                  <label className="text-xs" style={{ color: c.subtext }}>Nonce</label>
                  <input type="number" min={1} value={seeds.nonce} onChange={(e) => setSeeds((s) => ({ ...s, nonce: Number(e.target.value) }))} className="mt-1 w-full rounded-lg px-3 py-2 outline-none text-sm" style={{ backgroundColor: c.panelSoft, borderColor: c.border, borderWidth: 1 }} />
                </div>
                <div>
                  <label className="text-xs" style={{ color: c.subtext }}>Server seed (demo)</label>
                  <input type="text" value={seeds.serverSeed} onChange={(e) => setSeeds((s) => ({ ...s, serverSeed: e.target.value }))} className="mt-1 w-full rounded-lg px-3 py-2 outline-none text-sm" style={{ backgroundColor: c.panelSoft, borderColor: c.border, borderWidth: 1 }} />
                </div>
              </div>

              <div className="mt-4 text-[11px]" style={{ color: c.subtext }}>
                Commitment hash: <span className="font-mono break-all">{serverSeedHash || "—"}</span>
              </div>
            </div>
          </aside>
		  
		  

          {/* RIGHT: SLIDER + ADVANCED */}
          <div className="rounded-xl p-4 md:p-6 space-y-4" style={{ backgroundColor: c.panel, borderColor: c.border, borderWidth: 1 }}>
		  {/* Recent results pills */}
		  <div className="flex flex-col h-full justify-between">
        <div className="flex flex-wrap gap-2 md:gap-2 items-center">
		  {recent.slice(0, 10).map((r, i) => (
			<div
			  key={i}
			  className="rounded-full px-3 md:px-4 py-1 text-[13px] md:text-sm font-semibold leading-none"
			  style={{
				backgroundColor: r.win ? c.accent : "#2e4250",   // green(win) / gray(loss)
				color: r.win ? "#032a14" : "#e0edf6",
				boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.12)",
			  }}
			  title={r.win ? "WIN" : "LOSS"}
			>
			  {r.v.toFixed(2)}
			</div>
		  ))} 
		  
		  {recent.length === 0 
  ? <div className="h-[2.5rem]">No recent bets</div>
  : null }
		  
		</div>
            

            {/* Track + thumb */}
            <div className="relative w-full h-14 flex items-center select-none margin-100" ref={barRef}>
              <div className="absolute inset-0 customround flex items-center" style={{ backgroundColor: c.sliderBg, border: `${BORDER_W}px solid ${c.sliderTrack}` }} />
              <div className="absolute h-2 rounded-full" style={{ left: SIDE_PAD, right: SIDE_PAD, background: trackGradient }} />
              {/* Thumb — drags in whole 1% steps */}
              <div className="absolute top-1/2 z-30" style={{ left: thumbLeftPx, transform: "translate(-50%, -50%)" }}>
                <div
                  role="slider"
                  aria-valuemin={MIN_T}
                  aria-valuemax={MAX_T}
                  aria-valuenow={threshold}
                  tabIndex={0}
                  onPointerDown={beginDrag}
                  className="rounded-md w-8 h-8 shadow flex items-center justify-center cursor-grab active:cursor-grabbing"
                  style={{ backgroundColor: c.thumb, color: "#fff" }}
                >
                  <RxDragHandleVertical className="w-4 h-4" />
                </div>
              </div>
			  
			  {/* Stake-like labels */}
            <div className="relative h-6 dicemarkerpadding" style={{ paddingLeft: SIDE_PAD, paddingRight: SIDE_PAD }}>
              {[0, 25, 50, 75, 100].map((n) => (
                <div
                  key={n}
                  className="absolute top-0 text-xs"
                  style={{
                    left: xFromPercent(n, innerWidth, SIDE_PAD),
                    transform: "translateX(-50%)",
                    color: c.text,
                  }}
                >
                  <div className="w-0 h-0 mx-auto border-l-4 border-r-4 border-transparent border-b-4" style={{ borderBottomColor: c.labelTrack, marginBottom: 2 }} />
                  <div className="text-[18px] leading-none">{n}</div>
                </div>
              ))}
            </div>

              {/* Last roll marker */}
              <AnimatePresence>
			  {lastRoll !== null && showMarker && (
				<motion.div
				  key="marker"
				  initial={{ opacity: 0, y: -6 }}
				  animate={{ opacity: 1, y: 0 }}
				  exit={{ opacity: 0, y: -6 }}
				  className="absolute top-0 z-30 dicemarker"
				  style={{
					left: xFromPercent(lastRoll!, innerWidth, SIDE_PAD),
					transform: "translate(-50%, -60%)",
				  }}
				>
				  <div className="relative">
					<div
					  className="rounded-lg px-3 py-2 text-xs font-semibold"
					  style={{
						backgroundColor: "#f1f5f9",
						color: lastWin ? c.green : c.red,
					  }}
					>
					  {lastRoll.toFixed(2)}
					</div>
					<div
					  className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-2 h-2 rotate-45"
					  style={{ backgroundColor: "#f1f5f9" }}
					/>
				  </div>
				</motion.div>
			  )}
			</AnimatePresence>
            </div>

            {/* Advanced fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 margin-100">
              {/* Multiplier */}
              <div className="rounded-lg p-3 space-y-1" style={{ backgroundColor: c.panelSoft, borderColor: c.border, borderWidth: 1 }}>
                <label className="text-xs" style={{ color: c.subtext }}>Multiplier</label>
                <input
                  type="text"
                  value={multField}
                  onFocus={() => setEditingMult(true)}
                  onBlur={() => {
                    setEditingMult(false);
                    const parsed = Number(multField.replace(",", "."));
                    if (Number.isFinite(parsed)) {
                      const ch = to2(winChanceFromMultiplier(parsed, houseEdge));
                      setThreshold(mode === "under" ? clampRange(ch) : clampRange(100 - ch)); // keep decimals
                    } else {
                      setMult(multiplierFromWinChance(chance, houseEdge));
                    }
                  }}
                  onChange={(e) => setMultField(e.target.value)}
                  className="w-full rounded px-2 py-2 text-sm outline-none" style={{ backgroundColor: c.panel, borderColor: c.border, borderWidth: 1 }}
                />
              </div>

              {/* Mode toggle (read-only field) */}
              <div className="rounded-lg p-3 space-y-1" style={{ backgroundColor: c.panelSoft, borderColor: c.border, borderWidth: 1 }}>
                <label className="text-xs" style={{ color: c.subtext }}>{mode === "under" ? "Roll Under" : "Roll Over"}</label>
                <div
                  onClick={toggleMode}
                  className="w-full rounded px-2 py-2 text-sm outline-none flex items-center justify-between cursor-pointer select-none"
                  style={{ backgroundColor: c.panel, borderColor: c.border, borderWidth: 1 }}
                  title="Click to toggle Over/Under"
                >
                  <span>{threshold.toFixed(2)}</span>
                  <FiRefreshCw className="opacity-80" />
                </div>
              </div>

              {/* Win chance (decimal allowed) */}
              <div className="rounded-lg p-3 space-y-1" style={{ backgroundColor: c.panelSoft, borderColor: c.border, borderWidth: 1 }}>
                <label className="text-xs" style={{ color: c.subtext }}>Win Chance</label>
                <input
                  type="text"
                  value={chanceField}
                  onFocus={() => setEditingChance(true)}
                  onBlur={() => {
                    setEditingChance(false);
                    const parsed = Number(chanceField.replace(",", "."));
                    if (!Number.isFinite(parsed)) { setChanceField(chance.toFixed(2)); return; }
                    const ch = to2(clamp(parsed, 0.01, 99.99));
                    setThreshold(mode === "under" ? clampRange(ch) : clampRange(100 - ch));
                  }}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (/^\d{0,2}(?:[.,]\d{0,2})?$/.test(raw)) setChanceField(raw);
                  }}
                  className="w-full rounded px-2 py-2 text-sm outline-none" style={{ backgroundColor: c.panel, borderColor: c.border, borderWidth: 1 }}
                />
              </div>
            </div>
			</div>

            {/*<AnimatePresence>
              {result !== null && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="rounded-lg p-4 text-center font-semibold margin-44"
                  style={{ backgroundColor: (win ? c.green : c.red) + "20", border: `1px solid ${c.border}` }}
                >
                  Roll: {result.toFixed(2)} — {win ? "WIN" : "LOSS"}
                </motion.div>
              )}
            </AnimatePresence>*/}
          </div>
        </div>
      </div>
    </div>
  );
}
