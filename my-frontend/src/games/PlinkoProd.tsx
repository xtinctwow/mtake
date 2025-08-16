// src/games/PlinkoProd.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useCurrency } from "../context/CurrencyContext";
import { usePrices } from "../context/PricesContext";
import PlinkoProdUI from "./UI/PlinkoProdUI";

/* ---------- Types from wrapper/backend ---------- */
type PlaceResp = { roundId: string; clientSeed: string; nonce: number; serverSeedHash: string };
type ResolveResp = {
  serverSeed: string;
  payout: number;
  index: number;                 // 0..rows (slot)
  path: ("L" | "R")[];           // length == rows
  rows: number;
  risk: "low" | "medium" | "high";
  multiplier: number;
};
type Props = {
  onPlaceBet: (
    bet: number,
    params: { rows: number; risk: "low" | "medium" | "high" },
    seeds: { clientSeed: string; nonce?: number }
  ) => Promise<PlaceResp>;
  onResolve: (roundId: string) => Promise<ResolveResp>;
  onSettle: (roundId: string) => void;        // ← poravnava balance po animaciji
  minBet: number;
  maxBet: number;
  houseEdge: number;
};

/* ------------------------------------------------------------------
 *  Stake opis: min/max po rows & risk → generiramo payout tabelo
 * ------------------------------------------------------------------ */
const STAKE_RANGE: Record<"low" | "medium" | "high", Record<number, { min: number; max: number }>> = {
  low:    { 8:{min:0.5,max:5.6}, 9:{min:0.7,max:5.6}, 10:{min:0.5,max:8.9}, 11:{min:0.7,max:8.4}, 12:{min:0.5,max:10},
            13:{min:0.7,max:8.1}, 14:{min:0.5,max:7.1}, 15:{min:0.7,max:15}, 16:{min:0.5,max:16} },
  medium: { 8:{min:0.4,max:13}, 9:{min:0.5,max:18}, 10:{min:0.4,max:22}, 11:{min:0.5,max:24}, 12:{min:0.3,max:33},
            13:{min:0.4,max:43}, 14:{min:0.2,max:58}, 15:{min:0.3,max:88}, 16:{min:0.3,max:110} },
  high:   { 8:{min:0.2,max:29}, 9:{min:0.2,max:43}, 10:{min:0.2,max:76}, 11:{min:0.2,max:120}, 12:{min:0.2,max:170},
            13:{min:0.2,max:260}, 14:{min:0.2,max:420}, 15:{min:0.2,max:620}, 16:{min:0.2,max:1000} },
};

const LOW_8_EXACT = [5.6, 2.1, 1.1, 1.0, 0.5, 1.0, 1.1, 2.1, 5.6];
const GAMMA: Record<"low" | "medium" | "high", number> = { low: 1.7, medium: 1.35, high: 1.15 };

function buildMultipliers(rows: number, risk: "low" | "medium" | "high"): number[] {
  if (risk === "low" && rows === 8) return LOW_8_EXACT.slice();
  const rr = STAKE_RANGE[risk][rows];
  const slots = rows + 1;
  const arr = new Array<number>(slots).fill(0);
  const gamma = GAMMA[risk];
  const { min, max } = rr;

  const midLeft = Math.floor((slots - 1) / 2);
  const midRight = slots % 2 === 1 ? midLeft : midLeft + 1;

  arr[midLeft] = min;
  if (midRight !== midLeft) arr[midRight] = min;

  const steps = midLeft;
  for (let d = 1; d <= steps; d++) {
    const t = Math.pow(d / steps, gamma);
    const val = min * Math.pow(max / min, t);
    arr[midLeft - d] = val;
    arr[midRight + (d - (slots % 2 === 1 ? 0 : 1))] = val;
  }
  arr[0] = max;
  arr[slots - 1] = max;
  return arr;
}

const ROWS_OPTIONS = [8, 10, 12, 14, 16] as const;
const clamp = (n: number, mi: number, ma: number) => Math.min(ma, Math.max(mi, n));
const fmt8 = (n: number) => n.toFixed(8);

export default function PlinkoProd({
  onPlaceBet, onResolve, onSettle, minBet = 0, maxBet = 1000,
}: Props) {
  const { selectedCurrency } = useCurrency();
  const prices = usePrices();

  const theme = useMemo(() => ({
    appBg: "#1a2c38",
    panel: "#0f212e",
    panelSoft: "#152532",
    border: "#2a4152",
    text: "#d7e1ea",
    subtext: "#91a3b0",
    accent: "#00e701",
    accentText: "#001b0a",
    peg: "#e7eef5",
    ball: "#ffa024",
  }), []);

  /* seeds (commit/reveal) */
  const [seeds, setSeeds] = useState(() => {
    try { return JSON.parse(localStorage.getItem("plinkoSeeds") || "{}"); }
    catch { return {}; }
  }) as [any, any];

  /* controls */
  const [betStr, setBetStr] = useState("0.00000000");
  const bet = useMemo(() => {
    const n = Number(betStr);
    return Number.isFinite(n) ? clamp(n, 0, maxBet) : 0;
  }, [betStr, maxBet]);
  const [rows, setRows] = useState<number>(12);
  const [risk, setRisk] = useState<"low" | "medium" | "high">("medium");

  /* ---------- Responsive board sizing ---------- */
  const boardWrapRef = useRef<HTMLDivElement | null>(null);
  const [wrapW, setWrapW] = useState(720);
  useEffect(() => {
    const el = boardWrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width || el.clientWidth;
      setWrapW(Math.max(420, Math.min(980, Math.floor(w - 24))));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // geometry
  const margin = 28;
  const hGap = useMemo(() => (wrapW - margin * 2) / (rows + 2), [wrapW, rows]); // +2 zaradi novega razporeda
  const vGap = hGap;
  const centerX = useMemo(() => wrapW / 2, [wrapW]);
  const boardW = useMemo(() => wrapW, [wrapW]);
  const boardH = useMemo(() => margin * 2 + (rows - 1) * vGap + Math.max(56, vGap * 2.3), [rows, vGap, margin]);

  /* ----------- NOV RAZPORED PEGOV: prva 3, druga 4, potem 5,6,... ----------- */
  const pegCountAt = (r: number) => r + 3; // 0→3, 1→4, ..., (rows-1)→rows+2

  // pozicija pega v vrstici r na indeksu i (0..pegCountAt(r)-1)
  const pegPos = (r: number, i: number) => {
    const cnt = pegCountAt(r);
    return {
      x: centerX + (i - (cnt - 1) / 2) * hGap,
      y: margin + r * vGap,
    };
  };

  // center žepka i (0..rows) — med peg-i zadnje vrstice
  const slotPos = (i: number) => {
    const lastCnt = pegCountAt(rows - 1); // = rows + 2
    const x = centerX + ((i + 0.5) - (lastCnt - 1) / 2) * hGap; // točno med peg-i
    const y = margin + (rows - 1) * vGap + vGap * 0.68;
    return { x, y };
  };

  /* balls (concurrent – ne prekinjamo starih) */
  type Ball = { id: string; pos: { x: number; y: number }; done: boolean; bornAt: number };
  const [balls, setBalls] = useState<Ball[]>([]);
  const [results, setResults] = useState<number[]>([]);
  const table = useMemo(() => buildMultipliers(rows, risk), [rows, risk]);
  const slots = rows + 1;

  // animacija: start nad SREDINSKIM pegom 1. vrstice (index 1 od 3)
  function animateBall(
    id: string,
    path: ("L" | "R")[],
    finalSlot: number,
    mul: number,
    onDone?: () => void             // ← callback po pristanku
  ) {
    let level = 0, rights = 0;

    setBalls(bs => bs.map(b =>
      b.id === id ? { ...b, pos: { x: pegPos(0, 1).x, y: pegPos(0, 1).y - vGap * 0.6 } } : b
    ));

    const step = () => {
      if (level >= path.length) { finishToSlot(); return; }
      if (path[level] === "R") rights++;
      level++;
      // v vrstici "level" je pegCountAt(level) pegov → uporabimo baseline + rights
      const p = pegPos(level, rights + 1);
      setBalls(bs => bs.map(b => (b.id === id ? { ...b, pos: p } : b)));
      setTimeout(step, 140);
    };

    const finishToSlot = () => {
      const s = slotPos(finalSlot);
      setBalls(bs => bs.map(b => b.id === id ? { ...b, pos: s, done: true } : b));
      setResults(rs => [mul, ...rs].slice(0, 12));
      // odstrani žogico in šele nato sproži onDone (poravnava)
      setTimeout(() => {
        setBalls(bs => bs.filter(b => b.id !== id).slice(-60));
        onDone?.();
      }, 0);
    };

    setTimeout(step, 150);
  }

  async function dropOne() {
    if (bet !== 0 && (bet < minBet || bet > maxBet)) {
      alert(`Bet must be between ${minBet} and ${maxBet}.`);
      return;
    }

    const id = crypto.randomUUID();
    // postavi začetno žogico nad sredinski peg (index 1)
    setBalls(bs => [...bs, { id, pos: { x: pegPos(0, 1).x, y: pegPos(0, 1).y - vGap * 0.6 }, done: false, bornAt: Date.now() }]);

    try {
      const clientSeedToUse =
        (seeds as any).clientSeed ||
        crypto.getRandomValues(new Uint8Array(16)).reduce((a, v) => a + v.toString(16).padStart(2, "0"), "");

      const placed = await onPlaceBet(bet, { rows, risk }, { clientSeed: clientSeedToUse, nonce: (seeds as any).nonce ?? 0 });
      setSeeds((s: any) => {
        const next = { ...s, clientSeed: placed.clientSeed, nonce: placed.nonce, serverSeedHash: placed.serverSeedHash, serverSeed: "" };
        localStorage.setItem("plinkoSeeds", JSON.stringify(next));
        return next;
      });

      const res = await onResolve(placed.roundId); // <- backend NE kreditira (credit:false v Page)
      setSeeds((s: any) => {
        const next = { ...s, serverSeed: res.serverSeed };
        localStorage.setItem("plinkoSeeds", JSON.stringify(next));
        return next;
      });

      const tableForRound = buildMultipliers(res.rows, res.risk);
      const computedMul = tableForRound?.[res.index] ?? res.multiplier;

      // Bilanco poravnamo šele po pristanku
      animateBall(id, res.path, res.index, computedMul, () => onSettle(placed.roundId));

    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Plinko failed");
      setBalls(bs => bs.filter(b => b.id !== id));
    }
  }

  const betUsd = useMemo(() => {
    const p = selectedCurrency === "BTC" ? prices?.BTC : prices?.SOL;
    return p ? `$${(bet * p).toFixed(2)}` : "$0.00";
  }, [bet, prices, selectedCurrency]);

  const [showFair, setShowFair] = useState(false);
  
  // --- helperji za verjetnost in hover stanje ---
  const [hoverSlot, setHoverSlot] = useState<number | null>(null);

  function binom(n: number, k: number) {
    if (k < 0 || k > n) return 0;
    if (k > n - k) k = n - k;
    let res = 1;
    for (let i = 1; i <= k; i++) res = (res * (n - k + i)) / i;
    return res;
  }

  function chancePct(index: number, nRows = rows) {
    const p = binom(nRows, index) / Math.pow(2, nRows);
    return p * 100;
  }

  // Barva po multiplikatorju (kvantiziramo na 2 dec. da se "0.46x" vedno pobarva enako)
  function colorForMultiplier(m: number, table: number[], decimals = 2) {
    const min = Math.min(...table);
    const max = Math.max(...table);
    const q   = Number(m.toFixed(decimals));           // poravnaj na prikaz
    const t   = (q - min) / Math.max(1e-12, max - min); // 0..1

    // center (min) → rumena, rob (max) → rdeča
    const from = [245, 197, 66];
    const to   = [235, 38, 32];
    const c = from.map((f, i) => Math.round(f + (to[i] - f) * t));
    return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
  }

  /* ------------------------------ UI ------------------------------ */
  return (
    <PlinkoProdUI
      theme={theme}
      selectedCurrency={selectedCurrency}
      prices={prices}

      betStr={betStr}
      setBetStr={setBetStr}
      betUsd={betUsd}
      minBet={minBet}
      maxBet={maxBet}

      risk={risk}
      setRisk={setRisk}
      rows={rows}
      setRows={setRows}
      dropOne={dropOne}

      showFair={showFair}
      setShowFair={setShowFair}
      seeds={seeds}

      boardWrapRef={boardWrapRef}
      boardW={boardW}
      boardH={boardH}
      wrapW={wrapW}
      hGap={hGap}
      vGap={vGap}
      pegPos={pegPos}
      slotPos={slotPos}

      balls={balls}
      results={results}
      slots={slots}
      table={table}

      hoverSlot={hoverSlot}
      setHoverSlot={setHoverSlot}
      chancePct={chancePct}

      colorForMultiplier={colorForMultiplier}
      clamp={clamp}
      fmt8={fmt8}
      ROWS_OPTIONS={ROWS_OPTIONS}
    />
  );
}
