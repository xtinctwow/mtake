import React, { useMemo, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCurrency } from "../context/CurrencyContext";

// ---------- Combinatorics for fair payout multiplier ----------
function comb(n: number, k: number) {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - (k - i))) / i;
  return r;
}
function fairMultiplier({
  tiles = 25,
  mines,
  safeRevealed,
  houseEdge = 0.01,
}: {
  tiles?: number;
  mines: number;
  safeRevealed: number;
  houseEdge?: number;
}) {
  if (safeRevealed <= 0) return 1;
  const numerator = comb(tiles, safeRevealed);
  const denominator = comb(tiles - mines, safeRevealed);
  const raw = numerator / denominator;
  return raw * (1 - houseEdge);
}

// ---------- Icons ----------
const Bomb = (props: any) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M13 7h-2V3h2v4Zm4.95-1.536-1.414-1.414 2.828-2.829 1.415 1.415-2.83 2.828ZM7.464 5.464 4.636 2.636 6.05 1.222l2.828 2.829-1.414 1.414ZM12 8a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z" />
  </svg>
);
export const Diamond = ({ className = "" }: { className?: string }) => (
  <img
    src="/diamond.png"           // ker je v public/, gre absolutna pot
    alt="Diamond"
    className={`w-16 h-16 select-none pointer-events-none ${className}`}
    draggable={false}
  />
);

export const Tnt = ({ className = "" }: { className?: string }) => (
  <img
    src="/bomb.png"           // ker je v public/, gre absolutna pot
    alt="bomb"
    className={`w-16 h-16 select-none pointer-events-none ${className}`}
    draggable={false}
  />
);

// ---------- Types ----------
type Seeds = { serverSeed?: string; clientSeed: string; nonce: number };
type GridCell = { revealed: boolean; kind: "unknown" | "safe" | "mine"; wasClicked?: boolean };

export default function MinesProd({
  houseEdge = 0.01,
  defaultMines = 3,
  minBet = 0,
  maxBet = 1000,
  onPlaceBet,
  onReveal,
  onCashout,
}: {
  houseEdge?: number;
  defaultMines?: number;
  minBet?: number;
  maxBet?: number;
  onPlaceBet: (
    bet: number,
    params: { mines: number; currency: "BTC" | "SOL" },
    seeds: Seeds
  ) => Promise<{
    roundId: string;
    serverSeedHash: string;
    clientSeed: string;
    nonce: number;
  }>;
  onReveal: (roundId: string, index: number) => Promise<{
    hitMine: boolean;
    safeRevealed: number;
    status: "live" | "bust";
    layout?: number[]; // 25 ints: 1=mine, 0=safe
    serverSeed?: string;
  }>;
  onCashout: (roundId: string, safeRevealed: number) => Promise<{
    serverSeed: string;
    payout: number;        // stake + profit
    layout?: number[];     // 25 ints
  }>;
}) {
  const { selectedCurrency, adjustBalance } = useCurrency();

  // ----- Skin -----
  const c = useMemo(
    () => ({
      appBg: "#1a2c38",
      panel: "#0f212e",
      panelSoft: "#152532",
      tile: "#213743",
      tileHover: "#2a4152",
      tileSafe: "#1f3a46",
      tileMine: "#3a2328",
      border: "#2a4152",
      text: "#d7e1ea",
      subtext: "#91a3b0",
      accent: "#00e701",
      accentText: "#001b0a",
    }),
    []
  );

  // ----- State -----
  const [bet, setBet] = useState<number>(0);
  const [betField, setBetField] = useState<string>(minBet.toFixed(8));
  const [editingBet, setEditingBet] = useState<boolean>(false);

  const [mines, setMines] = useState<number>(defaultMines);
  const [seeds, setSeeds] = useState<Seeds>({ clientSeed: "", nonce: 1 });
  const [serverSeedHash, setServerSeedHash] = useState("");
  const [roundId, setRoundId] = useState<string | null>(null);

  const [active, setActive] = useState(false);
  const [busted, setBusted] = useState(false);
  const [safeRevealed, setSafeRevealed] = useState(0);
  const [grid, setGrid] = useState<GridCell[]>(
    () => Array.from({ length: 25 }, () => ({ revealed: false, kind: "unknown", wasClicked: false }))
  );
  const focusRef = useRef<HTMLDivElement>(null);

  useEffect(() => { focusRef.current?.focus(); }, [active]);

  // sync text polje
  useEffect(() => { if (!editingBet) setBetField(bet.toFixed(8)); }, [bet, editingBet]);

  const clampNum = (n: number) => Math.min(Math.max(n, minBet), maxBet);

  const tilesLeft = 25 - safeRevealed;
  const currentMult = fairMultiplier({ tiles: 25, mines, safeRevealed, houseEdge });
  const potentialPayout = (bet * currentMult).toFixed(8);

  // ----- Actions -----
  async function startRound() {
    if (bet < minBet || bet > maxBet) {
      alert(`Bet must be between ${minBet} and ${maxBet}.`);
      return;
    }
    // clientSeed
    let cs = seeds.clientSeed?.trim();
    if (!cs) {
      cs = crypto.getRandomValues(new Uint8Array(16))
        .reduce((acc, v) => acc + v.toString(16).padStart(2, "0"), "");
    }
    const seedsForRound = { clientSeed: cs, nonce: Number(seeds.nonce) || 1 };

    try {
      const resp = await onPlaceBet(
        bet,
        { mines, currency: selectedCurrency as "BTC" | "SOL" },
        seedsForRound
      );

      if (bet > 0) adjustBalance(selectedCurrency, -bet);

      setSeeds(prev => ({
        ...prev,
        clientSeed: resp.clientSeed || seedsForRound.clientSeed,
        nonce: resp.nonce || seedsForRound.nonce,
      }));
      setRoundId(resp.roundId);
      setServerSeedHash(resp.serverSeedHash);

      // reset board
      setGrid(Array.from({ length: 25 }, () => ({ revealed: false, kind: "unknown", wasClicked: false })));
      setSafeRevealed(0);
      setBusted(false);
      setActive(true);
    } catch (e) {
      console.error("place-bet failed", e);
      alert((e as any)?.message || "Bet failed.");
    }
  }

  async function clickTile(idx: number) {
    if (!active || busted || roundId == null) return;
    const cell = grid[idx];
    if (cell.revealed) return;

    try {
      const res = await onReveal(roundId, idx);

      if (res.hitMine) {
        // BUST: razkrij vse; tvoji kliki = svetlejši
        setBusted(true);
        setActive(false);

        if (res.layout && res.layout.length === 25) {
          setGrid(prev =>
            prev.map((c, i) => ({
              revealed: true,
              kind: res.layout![i] ? "mine" : "safe",
              wasClicked: c.wasClicked || i === idx, // kliknjena mina + prej kliknjeni safe
            }))
          );
        } else {
          // vsaj kliknjeno označi kot mino (ostalo ostane)
          setGrid(prev =>
            prev.map((c, i) =>
              i === idx ? { revealed: true, kind: "mine", wasClicked: true } : c
            )
          );
        }
        return;
      }

      // SAFE: samo kliknjeno polje razkrij + označi clicked
      setGrid(prev =>
        prev.map((c, i) =>
          i === idx ? { revealed: true, kind: "safe", wasClicked: true } : c
        )
      );
      setSafeRevealed(res.safeRevealed);

      // auto cashout, če so vsi safi odkriti
      if (res.status === "live" && res.safeRevealed >= 25 - mines) {
        await cashOut();
      }
    } catch (e) {
      console.error("reveal failed", e);
      alert("Reveal failed. Try again.");
    }
  }

  async function cashOut() {
    if (!active || roundId == null) return;
    try {
      const res = await onCashout(roundId, safeRevealed);

      if (res?.payout && res.payout > 0) {
        adjustBalance(selectedCurrency, res.payout);
      }

      // razkrij layout: tvoji kliki ostanejo svetlejši
      if (res.layout && res.layout.length === 25) {
        setGrid(prev =>
          prev.map((c, i) => ({
            revealed: true,
            kind: res.layout![i] ? "mine" : "safe",
            wasClicked: c.wasClicked, // ohrani klikane
          }))
        );
      }

      setSeeds(prev => ({ ...prev, serverSeed: res.serverSeed }));
    } catch (e) {
      console.error("cashout failed", e);
      alert("Cashout failed. Try again.");
    } finally {
      setActive(false);
    }
  }

  function resetRound() {
    setActive(false);
    setBusted(false);
    setSafeRevealed(0);
    setGrid(Array.from({ length: 25 }, () => ({ revealed: false, kind: "unknown", wasClicked: false })));
  }

  // ----- UI -----
  return (
    <div className="w-full" style={{ backgroundColor: c.appBg, color: c.text }}>
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4 md:gap-6">
          {/* LEFT: Controls */}
          <aside className="rounded-xl border" style={{ backgroundColor: c.panel, borderColor: c.border }}>
            <div className="p-4 md:p-5">
              <label className="text-xs" style={{ color: c.subtext }}>Bet Amount</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={betField}
                  disabled={active}
                  onFocus={() => setEditingBet(true)}
                  onChange={(e) => {
                    let raw = e.target.value.replace(",", ".").replace(/[^0-9.]/g, "");
                    const parts = raw.split(".");
                    if (parts.length > 2) raw = parts[0] + "." + parts.slice(1).join("");
                    setBetField(raw);
                    const parsed = parseFloat(raw);
                    if (!Number.isNaN(parsed)) setBet(clampNum(parsed));
                  }}
                  onBlur={() => {
                    setEditingBet(false);
                    const parsed = parseFloat(betField.replace(",", "."));
                    const safe = Number.isNaN(parsed) ? bet : clampNum(parsed);
                    setBet(safe);
                    setBetField(safe.toFixed(8));
                  }}
                  className="flex-1 rounded-lg px-3 py-2 outline-none text-sm"
                  style={{ backgroundColor: c.panelSoft, borderColor: c.border, borderWidth: 1 }}
                />
                <div className="flex items-center gap-1">
                  <button
                    disabled={active}
                    onClick={() => {
                      const next = clampNum(Number((bet / 2).toFixed(8)));
                      setBet(next);
                      setBetField(next.toFixed(8));
                    }}
                    className="px-2 py-2 rounded-lg text-sm"
                    style={{ backgroundColor: c.panelSoft, borderColor: c.border, borderWidth: 1 }}
                  >½</button>
                  <button
                    disabled={active}
                    onClick={() => {
                      const next = clampNum(Number((bet * 2).toFixed(8)));
                      setBet(next);
                      setBetField(next.toFixed(8));
                    }}
                    className="px-2 py-2 rounded-lg text-sm"
                    style={{ backgroundColor: c.panelSoft, borderColor: c.border, borderWidth: 1 }}
                  >2×</button>
                </div>
              </div>
              <p className="text-[11px] mt-1" style={{ color: c.subtext }}>Min {minBet} • Max {maxBet}</p>

              <div className="mt-4">
                <label className="text-xs" style={{ color: c.subtext }}>Mines</label>
                <select
                  value={mines}
                  disabled={active}
                  onChange={(e) => setMines(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg px-3 py-2 outline-none text-sm"
                  style={{ backgroundColor: c.panelSoft, borderColor: c.border, borderWidth: 1 }}
                >
                  {Array.from({ length: 24 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="mt-4">
                {!active ? (
                  <button
                    onClick={startRound}
                    className="w-full font-semibold rounded-lg py-3"
                    style={{ backgroundColor: c.accent, color: c.accentText }}
                  >
                    Bet
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={cashOut}
                      disabled={safeRevealed === 0 || busted}
                      className="flex-1 font-semibold rounded-lg py-3 disabled:opacity-60"
                      style={{ backgroundColor: c.accent, color: c.accentText }}
                    >
                      Cash Out (× {currentMult.toFixed(4)})
                    </button>
                    <button
                      onClick={resetRound}
                      className="px-4 rounded-lg"
                      style={{ backgroundColor: c.panelSoft, color: c.text, borderColor: c.border, borderWidth: 1 }}
                    >
                      Reset
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 mt-4 text-sm">
                <div className="rounded-lg p-3" style={{ backgroundColor: c.panelSoft, borderColor: c.border, borderWidth: 1 }}>
                  <p className="text-xs" style={{ color: c.subtext }}>Current multiplier</p>
                  <p className="text-lg font-semibold">× {currentMult.toFixed(4)}</p>
                </div>
                <div className="rounded-lg p-3" style={{ backgroundColor: c.panelSoft, borderColor: c.border, borderWidth: 1 }}>
                  <p className="text-xs" style={{ color: c.subtext }}>Potential payout</p>
                  <p className="text-lg font-semibold">{potentialPayout}</p>
                </div>
              </div>

              {/* Seeds (read-only, server managed nonce) */}
              <div className="mt-4 grid grid-cols-1 gap-3 text-sm">
                <div>
                  <label className="text-xs" style={{ color: c.subtext }}>Client seed</label>
                  <input
                    readOnly
                    value={seeds.clientSeed || ""}
                    className="mt-1 w-full rounded-lg px-3 py-2 outline-none"
                    style={{ backgroundColor: c.panelSoft, borderColor: c.border, borderWidth: 1 }}
                  />
                </div>
                <div>
                  <label className="text-xs" style={{ color: c.subtext }}>Nonce</label>
                  <input
                    readOnly
                    value={seeds.nonce}
                    className="mt-1 w-full rounded-lg px-3 py-2 outline-none"
                    style={{ backgroundColor: c.panelSoft, borderColor: c.border, borderWidth: 1 }}
                  />
                </div>
                <div>
                  <label className="text-xs" style={{ color: c.subtext }}>Server seed hash</label>
                  <div className="mt-1 font-mono text-xs break-all opacity-90">{serverSeedHash || "—"}</div>
                </div>
              </div>
            </div>
          </aside>

          {/* RIGHT: Grid */}
          <div
            className="rounded-xl p-4 md:p-6 space-y-4 outline-none"
            style={{ backgroundColor: c.panel, borderColor: c.border, borderWidth: 1 }}
            tabIndex={0}
            ref={focusRef}
          >
            <div className="grid grid-cols-5 gap-3">
              {grid.map((cell, i) => {
                const bg = !cell.revealed
                  ? c.tile
                  : cell.kind === "mine"
                  ? c.tileMine
                  : c.tileSafe;

                // neklikani razkriti elementi so malenkost temnejši
                const iconOpacity = cell.revealed ? (cell.wasClicked ? 1 : 0.55) : 1;

                return (
                  <button
                    key={i}
                    onClick={() => clickTile(i)}
                    disabled={!active || busted || cell.revealed}
                    className="relative aspect-square rounded-xl border flex items-center justify-center"
                    style={{
                      backgroundColor: bg,
                      borderColor: c.border,
                      cursor: (!active || busted || cell.revealed) ? "default" : "pointer",
                    }}
                  >
                    {/* highlight ring za kliknjene */}
                    {cell.revealed && cell.wasClicked && (
                      <div className="absolute inset-0 rounded-xl ring-2 ring-white/20 pointer-events-none" />
                    )}

                    <AnimatePresence>
                      {cell.revealed && (
                        <motion.div
                          initial={{ scale: 0.85, opacity: 0 }}
                          animate={{ scale: 1, opacity: iconOpacity }}
                          exit={{ scale: 0.9, opacity: 0 }}
                          transition={{ type: "spring", stiffness: 260, damping: 20 }}
                          className="flex items-center justify-center"
                          style={{ color: cell.kind === "mine" ? "#ff8787" : c.text }}
                        >
                          {cell.kind === "mine" ? <Tnt className="w-16 h-16" /> : <Diamond className="" />}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              {[
                ["Tiles left", tilesLeft],
                ["Safe revealed", safeRevealed],
                ["Mines", mines],
                ["Status", busted ? "BUST" : active ? "LIVE" : safeRevealed > 0 ? "ENDED" : "IDLE"],
              ].map(([label, value], idx) => (
                <div key={idx} className="rounded-lg p-3" style={{ backgroundColor: c.panelSoft, borderColor: c.border, borderWidth: 1 }}>
                  <p className="text-xs" style={{ color: c.subtext }}>{label}</p>
                  <p className="text-lg font-semibold">{String(value)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
