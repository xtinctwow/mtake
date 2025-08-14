// src/games/BaccaratProd.tsx
import React, { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useCurrency } from "../context/CurrencyContext";

type PlaceResp = { id: string; clientSeed: string; nonce: number; serverSeedHash: string };
type ResolveResp = {
  serverSeed: string;
  player: number[];
  banker: number[];
  pPoints: number;
  bPoints: number;
  winner: "player" | "banker" | "tie";
  natural: boolean;
  payout: number;
};

// Stake-like chip palette (label + numeric value + colors)
const CHIP_DEFS = [
  { label: "1", value: 0.00000001, bg: "#FFCE00", shadow: "#917000" },
  { label: "10", value: 0.00000010, bg: "#FEC30C", shadow: "#906600" },
  { label: "100", value: 0.00000100, bg: "#FEB918", shadow: "#905D00" },
  { label: "1K", value: 0.00001000, bg: "#FDAE23", shadow: "#8F5200" },
  { label: "10K", value: 0.00010000, bg: "#FCA32F", shadow: "#8E4800" },
  { label: "100K", value: 0.00100000, bg: "#FC8D28", shadow: "#8C3200" },
  { label: "1M", value: 0.01000000, bg: "#FC7820", shadow: "#8B1500" },
  { label: "10M", value: 0.10000000, bg: "#FC6218", shadow: "#8A0000" },
  { label: "100M", value: 1.00000000, bg: "#FC4C11", shadow: "#890000" },
  { label: "1B", value: 10.00000000, bg: "#F33919", shadow: "#800000" },
  { label: "10B", value: 100.00000000, bg: "#EB2620", shadow: "#790000" },
  { label: "100B", value: 1000.00000000, bg: "#E21328", shadow: "#700000" },
  { label: "1T", value: 10000.00000000, bg: "#D9002F", shadow: "#690000" },
] as const;

/* ---------- Chip carousel (Stake-like, fixed) ---------- */
function Chevron({ dir = "left" }: { dir?: "left" | "right" }) {
  return (
    <svg viewBox="0 0 64 64" width="16" height="16" fill="currentColor" aria-hidden>
      {dir === "left" ? (
        <path d="M36.998 53.996 16 32.998 36.998 12l6.306 6.306L28.61 33l14.694 14.694L36.998 54z"></path>
      ) : (
        <path d="m26.307 53.996 20.998-20.998L26.307 12 20 18.306 34.694 33 20.001 47.694 26.307 54z"></path>
      )}
    </svg>
  );
}

/** Hides native scrollbar and adds left/right arrow buttons. */
function ChipCarousel({
  items,
  value,
  onSelect,
  maxBet,
}: {
  items: typeof CHIP_DEFS;
  value: number;
  onSelect: (v: number) => void;
  maxBet: number;
}) {
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const [canLeft, setCanLeft] = React.useState(false);
  const [canRight, setCanRight] = React.useState(false);

  const updateBtns = React.useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanLeft(el.scrollLeft > 0);
    setCanRight(el.scrollLeft < maxScroll - 1);
  }, []);

  // Posodobi po mountu in ob resize/scroll
  React.useLayoutEffect(() => {
    updateBtns();
    const el = wrapRef.current;
    if (!el) return;
    const onScroll = () => updateBtns();
    el.addEventListener("scroll", onScroll, { passive: true });
    const onResize = () => updateBtns();
    window.addEventListener("resize", onResize);
    // še en frame kasneje, da ujame layout po fontih/slikah
    requestAnimationFrame(updateBtns);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [updateBtns, items]);

  const scrollByAmount = (dir: "left" | "right") => {
    const el = wrapRef.current;
    if (!el) return;
    const amount = Math.round(el.clientWidth * 0.8);
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <div className="relative">
      {/* arrows */}
      <button
        type="button"
        onClick={() => scrollByAmount("left")}
        disabled={!canLeft}
        className="inline-flex items-center justify-center absolute left-1 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-md"
        style={{
          background: "#3b4b57",
          border: "1px solid #2a4152",
          color: canLeft ? "#fff" : "#8aa0af",
          opacity: canLeft ? 1 : 0.5,
        }}
        aria-label="Scroll chips left"
      >
        <Chevron dir="left" />
      </button>

      <button
        type="button"
        onClick={() => scrollByAmount("right")}
        disabled={!canRight}
        className="inline-flex items-center justify-center absolute right-1 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-md"
        style={{
          background: "#3b4b57",
          border: "1px solid #2a4152",
          color: canRight ? "#fff" : "#8aa0af",
          opacity: canRight ? 1 : 0.5,
        }}
        aria-label="Scroll chips right"
      >
        <Chevron dir="right" />
      </button>

      {/* fades on edges */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 bottom-0 w-10 z-[5]"
        style={{
          background:
            "linear-gradient(90deg, rgba(15,33,46,1) 0%, rgba(15,33,46,0.6) 60%, rgba(15,33,46,0) 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 z-[5]"
        style={{
          background:
            "linear-gradient(270deg, rgba(15,33,46,1) 0%, rgba(15,33,46,0.6) 60%, rgba(15,33,46,0) 100%)",
        }}
      />

      {/* SCROLL AREA (dejanski scrollable element je ta div!) */}
      <style>{`.chip-scroll::-webkit-scrollbar{display:none}`}</style>
      <div
        ref={wrapRef}
        className="chip-scroll flex gap-2 px-9 py-1 rounded-lg"
        style={{
          background: "#142431",
          border: "1px solid #2a4152",
          overflowX: "auto",
          scrollbarWidth: "none" as any, // Firefox
          msOverflowStyle: "none" as any, // IE/Edge
        }}
      >
        {items.map((c) => {
          const selected = value === c.value;
          const disabled = c.value > maxBet; // soft disable

          return (
            <button
              key={c.label}
              onClick={() => !disabled && onSelect(c.value)}
              disabled={disabled}
              title={disabled ? `Over max bet (${maxBet})` : ""}
              className="relative flex items-center justify-center rounded-md font-semibold text-sm leading-none px-3 py-2 disabled:cursor-not-allowed"
              style={{
                backgroundColor: c.bg,
                backgroundImage: "url(/chips.svg)",
                backgroundSize: "cover",
                backgroundPosition: "center",
                color: "#111",
                border: `1px solid ${selected ? "#fff" : "transparent"}`,
                outline: selected ? "2px solid #fff" : "none",
				borderRadius: "1.5rem",
                minWidth: "33px",
                opacity: disabled ? 0.45 : 1,
                pointerEvents: disabled ? "none" : "auto",
              }}
              aria-pressed={selected}
              data-selected={selected}
            >
              <div className="pointer-events-none" style={{ filter: "drop-shadow(0 1px 0 rgba(0,0,0,.25))" }}>
                {c.label}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}



export default function BaccaratProd({
  onPlaceBet,
  onResolve,
  minBet = 0,
  maxBet = 1000,
  houseEdge = 0.0106,
}: {
  onPlaceBet: (
    bets: { player?: number; banker?: number; tie?: number },
    params: {},
    seeds: { clientSeed: string; nonce: number }
  ) => Promise<PlaceResp>;
  onResolve: (roundId: string) => Promise<ResolveResp>;
  minBet?: number;
  maxBet?: number;
  houseEdge?: number;
}) {
  /* theme */
  const { selectedCurrency, adjustBalance } = useCurrency();
  const theme = useMemo(
    () => ({
      appBg: "#1a2c38",
      panel: "#0f212e",
      panelSoft: "#152532",
      border: "#2a4152",
      text: "#d7e1ea",
      subtext: "#91a3b0",
      accent: "#00e701",
      accentText: "#001b0a",
      green: "#29ff5a",
    }),
    []
  );

  /* seeds (commit/reveal) */
  const [seeds, setSeeds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("baccSeeds") || "{}");
    } catch {
      return {};
    }
  }) as [any, any];

  /* chip & bets */
  const [chipValue, setChipValue] = useState<number>(CHIP_DEFS[0].value);
  const [bets, setBets] = useState<{ player: number; tie: number; banker: number }>({
    player: 0,
    tie: 0,
    banker: 0,
  });
  const betStack = useRef<{ key: "player" | "tie" | "banker"; delta: number }[]>([]);
  const totalBet = Number((bets.player + bets.tie + bets.banker).toFixed(8));
  const clamp = (v: number) => Number(Math.min(Math.max(v, 0), maxBet).toFixed(8));

  function addChip(k: "player" | "tie" | "banker") {
    const next = clamp(bets[k] + chipValue);
    const delta = Number((next - bets[k]).toFixed(8));
    if (delta === 0) return;
    setBets((b) => ({ ...b, [k]: next }));
    betStack.current.push({ key: k, delta }); // za Undo
  }
  function undo() {
    const last = betStack.current.pop();
    if (!last) return;
    setBets((b) => ({ ...b, [last.key]: clamp(b[last.key] - last.delta) }));
  }
  function clearBets() {
    betStack.current = [];
    setBets({ player: 0, tie: 0, banker: 0 });
  }
  function halfBets() {
    setBets((b) => ({
      player: clamp(b.player / 2),
      tie: clamp(b.tie / 2),
      banker: clamp(b.banker / 2),
    }));
  }
  function doubleBets() {
    setBets((b) => ({
      player: clamp(b.player * 2),
      tie: clamp(b.tie * 2),
      banker: clamp(b.banker * 2),
    }));
  }

  /* round */
  const [roundId, setRoundId] = useState<string | null>(null);
  const [rolling, setRolling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revealedP, setRevealedP] = useState<number[]>([]);
  const [revealedB, setRevealedB] = useState<number[]>([]);
  const [points, setPoints] = useState<{ p?: number; b?: number }>({});
  const [winner, setWinner] = useState<"" | "player" | "banker" | "tie">("");
  const [payout, setPayout] = useState(0);

  const betLocked = rolling || busy || (!!roundId && winner === "");

  /* cards helpers */
  const SUITS = ["♠", "♥", "♦", "♣"] as const;
  const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"] as const;
  const suitOf = (c: number) => Math.floor(c / 13) % 4;
  const rankOf = (c: number) => c % 13;
  const isRed = (s: number) => s === 1 || s === 2;

const Card = React.memo(function Card({ c }: { c: number }) {
  // helperji lokalno (lahko pustiš globalne, ni kritično)
  const SUITS = ["♠", "♥", "♦", "♣"] as const;
  const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"] as const;
  const suitOf = (x: number) => Math.floor(x / 13) % 4;
  const rankOf = (x: number) => x % 13;
  const isRed = (s: number) => s === 1 || s === 2;

  const s = suitOf(c), r = rankOf(c);
  const color = isRed(s) ? "#ff6b6b" : "#e6f0f7";

  return (
    <div
      className="relative w-16 h-24 sm:w-20 sm:h-28 rounded-xl border"
      style={{
        background: "#0b1620",
        borderColor: "#2a4152",
        willChange: "transform",
        transform: "translateZ(0)",
        backfaceVisibility: "hidden",
      }}
    >
      <div className="absolute inset-0 px-2 py-2 flex flex-col justify-between">
        <div className="font-bold leading-none" style={{ color }}>{RANKS[r]}</div>
        <div className="text-xl text-center" style={{ color }}>{SUITS[s]}</div>
        <div className="text-right opacity-80 leading-none" style={{ color, fontSize: 12 }}>{SUITS[s]}</div>
      </div>
    </div>
  );
});

  const fanOffsets = (i: number) => ({ ml: i === 0 ? "0em" : "-2.4em", mt: `${i * 1.0}em` });

  /* staged reveal (P1 → B1 → P2 → B2 → [P3] → [B3]) */
  async function animateReveal(res: ResolveResp) {
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
    setRevealedP([]);
    setRevealedB([]);
    setPoints({});
    setWinner("");
    setPayout(0);

    const order: Array<{ side: "P" | "B"; idx: number }> = [
      { side: "P", idx: 0 },
      { side: "B", idx: 0 },
      { side: "P", idx: 1 },
      { side: "B", idx: 1 },
    ];
    if (res.player.length === 3) order.push({ side: "P", idx: 2 });
    if (res.banker.length === 3) order.push({ side: "B", idx: 2 });

    for (let step = 0; step < order.length; step++) {
      const o = order[step];
      if (o.side === "P") setRevealedP((curr) => [...curr, res.player[o.idx]]);
      else setRevealedB((curr) => [...curr, res.banker[o.idx]]);
      await delay(350); // rahli delay med kartami
    }

    setPoints({ p: res.pPoints, b: res.bPoints });
    setWinner(res.winner);
    setPayout(res.payout);
  }

  async function placeAndResolve() {
    if (winner) {
      // prejšnja runda je zaključena -> reset UI (stave ostanejo)
      setRoundId(null);
      setRevealedP([]);
      setRevealedB([]);
      setPoints({});
      setWinner("");
      setPayout(0);
    }
    if (totalBet !== 0 && (totalBet < minBet || totalBet > maxBet)) {
      alert(`Total bet must be between ${minBet} and ${maxBet}.`);
      return;
    }
    setRolling(true);
    try {
      const clientSeedToUse =
        seeds.clientSeed ||
        crypto.getRandomValues(new Uint8Array(16)).reduce((a, v) => a + v.toString(16).padStart(2, "0"), "");

      const placed = await onPlaceBet(
        { player: bets.player, banker: bets.banker, tie: bets.tie },
        {},
        { clientSeed: clientSeedToUse, nonce: (seeds as any).nonce ?? 0 }
      );

      setSeeds((s: any) => {
        const next = {
          ...s,
          clientSeed: clientSeedToUse,
          nonce: placed.nonce,
          serverSeedHash: placed.serverSeedHash,
          serverSeed: "",
        };
        localStorage.setItem("baccSeeds", JSON.stringify(next));
        return next;
      });

      setRoundId(placed.id);

      if (totalBet > 0) adjustBalance(selectedCurrency, -totalBet);

      setBusy(true);
      const res = await onResolve(placed.id);

      setSeeds((s: any) => {
        const next = { ...s, serverSeed: res.serverSeed };
        localStorage.setItem("baccSeeds", JSON.stringify(next));
        return next;
      });

      await animateReveal(res);

      if (res.payout > 0) adjustBalance(selectedCurrency, res.payout);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Baccarat failed");
      // na failure ne popravljaj lokalnega balanca
      setRoundId(null);
      setRevealedP([]);
      setRevealedB([]);
      setPoints({});
      setWinner("");
      setPayout(0);
    } finally {
      setBusy(false);
      setRolling(false);
    }
  }

  /* left panel (Stake-like) */
  const leftPanel = (
    <aside className="rounded-xl border h-fit" style={{ backgroundColor: theme.panel, borderColor: theme.border }}>
      <div className="p-4 md:p-5">
        <div className="flex bg-[#0b1a23] rounded-full p-1 mb-4 w-fit">
          <button className="px-4 py-1.5 text-sm rounded-full" style={{ backgroundColor: theme.panel, color: theme.text }}>
            Manual
          </button>
          <button className="px-4 py-1.5 text-sm rounded-full text-[#7b8b97]">Auto</button>
        </div>

<div className="flex items-center justify-between mb-1">
  <div className="text-xs" style={{ color: theme.subtext }}>Chip Value</div>
  <div className="text-xs" style={{ color: theme.subtext }}>{chipValue.toFixed(8)} {selectedCurrency}</div>
</div>
<ChipCarousel
  items={CHIP_DEFS}
  value={chipValue}
  onSelect={(v)=> setChipValue(v)}
  maxBet={maxBet}
/>

        <div className="mt-3 flex items-center justify-between">
          <div className="text-xs" style={{ color: theme.subtext }}>
            Total Bet
          </div>
          <div className="text-xs" style={{ color: theme.subtext }}>
            ${(0).toFixed(2)}
          </div>
        </div>

        <div className="mt-1 flex items-center gap-2">
          <input
            readOnly
            value={totalBet.toFixed(8)}
            className="flex-1 rounded-lg px-3 py-2 outline-none text-sm"
            style={{ backgroundColor: theme.panelSoft, borderColor: theme.border, borderWidth: 1, color: theme.text }}
          />
          <button
            onClick={halfBets}
            disabled={betLocked}
            className="px-2 py-2 rounded-lg text-sm disabled:opacity-50"
            style={{ background: "#223442", border: `1px solid ${theme.border}`, color: theme.text }}
          >
            ½
          </button>
          <button
            onClick={doubleBets}
            disabled={betLocked}
            className="px-2 py-2 rounded-lg text-sm disabled:opacity-50"
            style={{ background: "#223442", border: `1px solid ${theme.border}`, color: theme.text }}
          >
            2×
          </button>
        </div>

        <div className="mt-3">
          <button
            onClick={placeAndResolve}
            disabled={betLocked}
            className="w-full font-semibold rounded-lg py-3 disabled:opacity-60"
            style={{ backgroundColor: theme.accent, color: theme.accentText }}
          >
            {rolling ? "Dealing…" : "Bet & Deal"}
          </button>
        </div>

        {/* Seeds */}
        <div className="mt-4 text-[11px]" style={{ color: theme.subtext }}>
          Commitment: <span className="font-mono break-all">{(seeds as any).serverSeedHash || "—"}</span>
        </div>
      </div>
    </aside>
  );

  /* pill */
  const pill = (t: string) => (
    <div
      className="px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: "#142431", border: `1px solid ${theme.border}`, color: theme.text }}
    >
      {t}
    </div>
  );

  /* main table */
  return (
    <div className="w-full" style={{ backgroundColor: theme.appBg, color: theme.text }}>
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4 md:gap-6">
          {leftPanel}

          <div
            className="min-h-[500px] rounded-xl px-4 md:px-8 py-6"
            style={{ backgroundColor: theme.panel, border: `1px solid ${theme.border}` }}
          >
            {/* Top points + cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6 min-h-[200px]">
              <div className="flex flex-col items-center">
                <div className="mb-2">{pill(`PLAYER ${points.p ?? ""}`)}</div>
                <div className="flex items-start justify-center">
                  {revealedP.map((c, i) => {
  const off = { ml: i === 0 ? "0em" : "-2.4em", mt: `${i * 1.0}em` };
  const isLast = i === revealedP.length - 1;

  const content = (
    <div style={{ marginLeft: off.ml, marginTop: off.mt }}>
      <Card c={c} />
    </div>
  );

  return isLast ? (
    <motion.div
      key={i}
      initial={{ y: -18, opacity: 0, scale: 0.9 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.05 }}
    >
      {content}
    </motion.div>
  ) : (
    <React.Fragment key={i}>{content}</React.Fragment>
  );
})}
                </div>
              </div>
              <div className="flex flex-col items-center">
                <div className="mb-2">{pill(`BANKER ${points.b ?? ""}`)}</div>
                <div className="flex items-start justify-center">
                  {revealedB.map((c, i) => {
  const off = { ml: i === 0 ? "0em" : "-2.4em", mt: `${i * 1.0}em` };
  const isLast = i === revealedB.length - 1;

  const content = (
    <div style={{ marginLeft: off.ml, marginTop: off.mt }}>
      <Card c={c} />
    </div>
  );

  return isLast ? (
    <motion.div
      key={i}
      initial={{ y: -18, opacity: 0, scale: 0.9 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.05 }}
    >
      {content}
    </motion.div>
  ) : (
    <React.Fragment key={i}>{content}</React.Fragment>
  );
})}
                </div>
              </div>
            </div>
			
			 {/* Banner */}
            <div className="flex justify-center my-2">
              <img src="/baccabg.svg" alt="Baccarat banner" className="w-full max-w-md opacity-90" />
            </div>
			
            {/* Center badge for result & payout */}
			<div className="flex justify-center mb-4 min-h-[40px] mt-[20px]">
			  {!!winner && (
				<div
				  className="px-4 py-2 rounded-xl font-semibold"
				  style={{
					border: `2px solid ${
					  (winner === "player" && bets.player > 0) ||
					  (winner === "banker" && bets.banker > 0) ||
					  (winner === "tie" && bets.tie > 0)
						? theme.green // win for that bet
						: "#a63b3b"   // loss or no bet on winner (red border)
					}`,
					color: theme.text,
					background: "rgba(32,64,80,.35)",
				  }}
				>
				  {winner.toUpperCase()} WINS {payout > 0 ? `· ${payout.toFixed(8)}` : ""}
				</div>
			  )}
			</div>

            {/* Betting tiles */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2 mt-[120px]">
              {(["player", "tie", "banker"] as const).map((k) => {
                const label = k === "player" ? "Player" : k === "banker" ? "Banker" : "Tie";
                return (
                  <button
                    key={k}
                    onClick={() => addChip(k)}
                    disabled={betLocked}
                    className="rounded-xl px-4 py-6 text-center"
                    style={{
                      background: "#0b1a23",
                      border: `1px solid ${theme.border}`,
                      boxShadow: "inset 0 0 0 2px rgba(0,0,0,.15)",
                    }}
                  >
                    <div className="text-lg font-semibold mb-1">{label}</div>
                    <div className="text-sm opacity-80">
                      {bets[k].toFixed(8)} {selectedCurrency}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Undo / Clear */}
            <div className="flex justify-between items-center mt-3 text-sm" style={{ color: theme.subtext }}>
              <button onClick={undo} disabled={betLocked} className="disabled:opacity-40">
                ↩ Undo
              </button>
              <button onClick={clearBets} disabled={betLocked} className="disabled:opacity-40">
                Clear ⟳
              </button>
            </div>

            {/* Footer info */}
            <div className="mt-6 text-xs text-center" style={{ color: theme.subtext }}>
              Min {minBet} · Max {maxBet} · House edge ~{(houseEdge * 100).toFixed(2)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
