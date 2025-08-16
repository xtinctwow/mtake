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
  index: number;
  path: ("L" | "R")[];
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
  onSettle: (roundId: string) => void;
  minBet: number;
  maxBet: number;
  houseEdge: number;
};

/* --- payout table helpers (skrajšano, isto kot prej) --- */
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

  /* ---------- SOUNDS ---------- */
  // Datoteke v /public: /bet.mp3, /win.mp3, /pocket.mp3
  const snd = useMemo(() => {
    const bet = new Audio("/bet.mp3");
    const win = new Audio("/win.mp3");
    const pocket = new Audio("/pocket.mp3");
    bet.volume = 1;
    win.volume = 1;
    pocket.volume = 1;
    return { bet, win, pocket };
  }, []);
  const play = (a: HTMLAudioElement) => {
    try {
      const clone = a.cloneNode(true) as HTMLAudioElement;
      clone.volume = a.volume;
      clone.currentTime = 0;
      void clone.play();
    } catch {}
  };

  /* seeds (commit/reveal) */
  const [seeds, setSeeds] = useState(() => {
    try { return JSON.parse(localStorage.getItem("plinkoSeeds") || "{}"); }
    catch { return {}; }
  }) as [any, any];

  // helperji: reset/random seeds
  const persistSeeds = (next: any) => {
    setSeeds(next);
    localStorage.setItem("plinkoSeeds", JSON.stringify(next));
  };
  const randomClientSeed = () =>
    crypto.getRandomValues(new Uint8Array(16))
      .reduce((a, v) => a + v.toString(16).padStart(2, "0"), "");

  const resetSeedsAll = () => {
    persistSeeds({ clientSeed: randomClientSeed(), nonce: 0, serverSeedHash: "", serverSeed: "" });
  };
  const randomizeClientSeed = () => {
    persistSeeds({ ...(seeds as any), clientSeed: randomClientSeed(), nonce: 0 });
  };
  const resetNonce = () => {
    persistSeeds({ ...(seeds as any), nonce: 0 });
  };
  const clearReveals = () => {
    persistSeeds({ ...(seeds as any), serverSeedHash: "", serverSeed: "" });
  };

  /* controls */
  const [betStr, setBetStr] = useState("0.00000000");
  const bet = useMemo(() => {
    const n = Number(betStr);
    return Number.isFinite(n) ? clamp(n, 0, maxBet) : 0;
  }, [betStr, maxBet]);
  const [rows, setRows] = useState<number>(12);
  const [risk, setRisk] = useState<"low" | "medium" | "high">("medium");

  /* input error (npr. insufficient funds) */
  const [betError, setBetError] = useState<string | null>(null);

  /* sizing */
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
  const hGap = useMemo(() => (wrapW - margin * 2) / (rows + 2), [wrapW, rows]);
  const vGap = hGap;
  const centerX = useMemo(() => wrapW / 2, [wrapW]);
  const boardW = useMemo(() => wrapW, [wrapW]);
  const boardH = useMemo(() => margin * 2 + (rows - 1) * vGap + Math.max(56, vGap * 2.3), [rows, vGap, margin]);

  const pegCountAt = (r: number) => r + 3;
  const pegPos = (r: number, i: number) => {
    const cnt = pegCountAt(r);
    return { x: centerX + (i - (cnt - 1) / 2) * hGap, y: margin + r * vGap };
  };
  const slotPos = (i: number) => {
    const lastCnt = pegCountAt(rows - 1);
    const x = centerX + ((i + 0.5) - (lastCnt - 1) / 2) * hGap;
    const y = margin + (rows - 1) * vGap + vGap * 0.68;
    return { x, y };
  };

  /* balls & results */
  type Ball = { id: string; pos: { x: number; y: number }; done: boolean; bornAt: number };
  const [balls, setBalls] = useState<Ball[]>([]);
  const [results, setResults] = useState<number[]>([]);
  const table = useMemo(() => buildMultipliers(rows, risk), [rows, risk]);
  const slots = rows + 1;

  const [landing, setLanding] = useState<{ slot: number; pulse: number }>({ slot: -1, pulse: 0 });

  function animateBall(
    id: string,
    path: ("L" | "R")[],
    finalSlot: number,
    mul: number,
    onDone?: () => void
  ) {
    const STEP_MS = 140;
    const START_DELAY_MS = 150;
    const BALL_REMOVE_DELAY_MS = 0;

    let level = 0;
    let rights = 0;

    setBalls(bs =>
      bs.map(b =>
        b.id === id
          ? { ...b, pos: { x: pegPos(0, 1).x, y: pegPos(0, 1).y - vGap * 0.6 } }
          : b
      )
    );

    const step = () => {
      if (level >= path.length) {
        finishToSlot();
        return;
      }
      if (path[level] === "R") rights++;
      level++;

      const p = pegPos(level, rights + 1);
      setBalls(bs => bs.map(b => (b.id === id ? { ...b, pos: p } : b)));

      setTimeout(step, STEP_MS);
    };

    const finishToSlot = () => {
      const s = slotPos(finalSlot);
      setBalls(bs => bs.map(b => (b.id === id ? { ...b, pos: s, done: true } : b)));
      setResults(rs => [mul, ...rs].slice(0, 12));

      // 🔊 zvok ob pristanku (<=2x pocket, >2x win)
      if (mul > 2) play(snd.win);
      else play(snd.pocket);

      // vizualni pulse žepka
      setLanding(prev => ({ slot: finalSlot, pulse: prev.pulse + 1 }));

      setTimeout(() => {
        setBalls(bs => bs.filter(b => b.id !== id).slice(-60));
        onDone?.();
      }, BALL_REMOVE_DELAY_MS);
    };

    setTimeout(step, START_DELAY_MS);
  }

  async function dropOne() {
    setBetError(null);
    if (bet !== 0 && (bet < minBet || bet > maxBet)) {
      setBetError(`Bet must be between ${minBet} and ${maxBet}.`);
      return;
    }

    // 🔊 BET zvok takoj po kliku (user gesture)
    play(snd.bet);

    const id = crypto.randomUUID();
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

      const res = await onResolve(placed.roundId);
      setSeeds((s: any) => {
        const next = { ...s, serverSeed: res.serverSeed };
        localStorage.setItem("plinkoSeeds", JSON.stringify(next));
        return next;
      });

      const tableForRound = buildMultipliers(res.rows, res.risk);
      const computedMul = tableForRound?.[res.index] ?? res.multiplier;

      animateBall(id, res.path, res.index, computedMul, () => onSettle(placed.roundId));
    } catch (e: any) {
      setBalls(bs => bs.filter(b => b.id !== id));
      const msg = (e && e.message) ? String(e.message) : "";
      if (/insufficient/i.test(msg)) {
        setBetError("Insufficient balance");
        return;
      }
      console.error(e);
      setBetError("Something went wrong. Try again.");
    }
  }

  const betUsd = useMemo(() => {
    const p = selectedCurrency === "BTC" ? prices?.BTC : prices?.SOL;
    return p ? `$${(bet * p).toFixed(2)}` : "$0.00";
  }, [bet, prices, selectedCurrency]);

  const [showFair, setShowFair] = useState(false);
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

  /* ---------- MULTICOLOR barvna lestvica (rumena → oranžna → rdeča) ---------- */
  const COLOR_STOPS: Array<{ pos: number; c: [number, number, number] }> = useMemo(() => ([
    { pos: 0.0,  c: [245, 197,  66] }, // rumena
    { pos: 0.01, c: [255, 144,  16] }, // oranžna (vmesna) rgb(255, 144, 16)
    { pos: 1.0,  c: [235,  38,  32] }, // rdeča
  ]), []);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const mix = (a: [number,number,number], b: [number,number,number], t: number): [number,number,number] =>
    [0,1,2].map(i => Math.round(lerp(a[i], b[i], t))) as [number,number,number];

  function colorForMultiplier(m: number, table: number[], decimals = 2) {
    const min = Math.min(...table);
    const max = Math.max(...table);
    const q   = Number(m.toFixed(decimals));
    const t0  = (q - min) / Math.max(1e-12, max - min);
    const t   = Math.max(0, Math.min(1, t0)); // clamp

    // najdi segment med stopnjama in interno normiraj
    let idx = 0;
    while (idx < COLOR_STOPS.length - 2 && t > COLOR_STOPS[idx + 1].pos) idx++;
    const a = COLOR_STOPS[idx];
    const b = COLOR_STOPS[idx + 1];
    const lt = (t - a.pos) / Math.max(1e-12, (b.pos - a.pos));

    const [r,g,b_] = mix(a.c, b.c, lt);
    return `rgb(${r}, ${g}, ${b_})`;
  }
  
  function colorForMultiplierRgb(m: number, table: number[], decimals = 2): [number, number, number] {
  const min = Math.min(...table);
  const max = Math.max(...table);
  const q   = Number(m.toFixed(decimals));
  const t0  = (q - min) / Math.max(1e-12, max - min);
  const t   = Math.max(0, Math.min(1, t0));

  const STOPS = [
    { pos: 0.0,  c: [245, 197,  66] as [number,number,number] }, // rumena
    { pos: 0.01, c: [255, 144,  16] as [number,number,number] }, // oranžna
    { pos: 1.0,  c: [235,  38,  32] as [number,number,number] }, // rdeča
  ];
  let idx = 0;
  while (idx < STOPS.length - 2 && t > STOPS[idx + 1].pos) idx++;
  const a = STOPS[idx], b = STOPS[idx + 1];
  const lt = (t - a.pos) / Math.max(1e-12, (b.pos - a.pos));
  const mix = (x: number, y: number, k: number) => Math.round(x + (y - x) * k);
  return [mix(a.c[0], b.c[0], lt), mix(a.c[1], b.c[1], lt), mix(a.c[2], b.c[2], lt)];
}

  /* ------------------------------ UI ------------------------------ */
  return (
    <PlinkoProdUI
      theme={theme}
      selectedCurrency={selectedCurrency}
      prices={prices}

      betStr={betStr}
      setBetStr={(v) => { setBetError(null); setBetStr(v); }}
      betError={betError}
      betUsd={betUsd}
      minBet={minBet}
      maxBet={maxBet}

      risk={risk}
      setRisk={(r) => { setBetError(null); setRisk(r); }}
      rows={rows}
      setRows={(r) => { setBetError(null); setRows(r); }}
      dropOne={dropOne}

      showFair={showFair}
      setShowFair={setShowFair}
      seeds={seeds}

      /* fairness actions */
      onResetSeedsAll={resetSeedsAll}
      onRandomizeClientSeed={randomizeClientSeed}
      onResetNonce={resetNonce}
      onClearReveals={clearReveals}

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
      landingSlot={landing.slot}
      landingPulse={landing.pulse}
	  colorForMultiplierRgb={colorForMultiplierRgb}
    />
  );
}
