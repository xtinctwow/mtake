import React, { useMemo, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Mines Game — Stake-style skin (5x5 grid)
 * Functionality matches the previous version; only the UI has been reskinned
 * to resemble Stake's dark teal palette and layout with a left control panel.
 */

// ---------- Utility: HMAC-SHA256 and helpers ----------
async function hmacSHA256(key, message) {
  const enc = new TextEncoder();
  const cryptoKey = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: { name: "SHA-256" } },
    false,
    ["sign"]
  );
  const sig = await window.crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return bufferToHex(sig);
}

function bufferToHex(buffer) {
  const bytes = new Uint8Array(buffer);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex;
}

function hexToFloat01(hex) {
  const slice = hex.slice(0, 13);
  const int = parseInt(slice, 16);
  const max = Math.pow(16, slice.length);
  return int / max; // [0,1)
}

async function* seededRandoms({ serverSeed, clientSeed, nonce }) {
  let cursor = 0;
  while (true) {
    const msg = `${serverSeed}:${clientSeed}:${nonce}:${cursor++}`;
    const hex = await hmacSHA256(serverSeed, msg);
    yield hexToFloat01(hex);
  }
}

async function seededShuffle(array, seeds) {
  const arr = array.slice();
  const randGen = seededRandoms(seeds);
  for (let i = arr.length - 1; i > 0; i--) {
    const { value: r } = await randGen.next();
    const j = Math.floor(r * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------- Combinatorics for fair payout multiplier ----------
function comb(n, k) {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let result = 1;
  for (let i = 1; i <= k; i++) {
    result = (result * (n - (k - i))) / i;
  }
  return result;
}

function fairMultiplier({ tiles = 25, mines, safeRevealed, houseEdge = 0.01 }) {
  if (safeRevealed <= 0) return 1;
  const numerator = comb(tiles, safeRevealed);
  const denominator = comb(tiles - mines, safeRevealed);
  const raw = numerator / denominator; // 1 / P(selecting k safe tiles w/o mine)
  return raw * (1 - houseEdge);
}

// ---------- Icons ----------
const Bomb = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M13 7h-2V3h2v4Zm4.95-1.536-1.414-1.414 2.828-2.829 1.415 1.415-2.83 2.828ZM7.464 5.464 4.636 2.636 6.05 1.222l2.828 2.829-1.414 1.414ZM12 8a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z" />
  </svg>
);

const Diamond = () => <span className="text-xl">💎</span>;

// ---------- Defaults ----------
const DEFAULT_SEEDS = {
  serverSeed: "DEMO_SERVER_SEED_DO_NOT_USE_IN_PROD",
  clientSeed: "client-1",
  nonce: 1,
};

export default function MinesGame({
  houseEdge = 0.01,
  defaultMines = 3,
  minBet = 0.1,
  maxBet = 1000,
  currency = "USD",
  onPlaceBet,
  onResolve,
}) {
  const [bet, setBet] = useState(1);
  const [mines, setMines] = useState(defaultMines);
  const [seeds, setSeeds] = useState(DEFAULT_SEEDS);
  const [grid, setGrid] = useState(() => Array.from({ length: 25 }, () => ({ revealed: false, isMine: false })));
  const [active, setActive] = useState(false);
  const [busted, setBusted] = useState(false);
  const [safeRevealed, setSafeRevealed] = useState(0);
  const [cashoutLocked, setCashoutLocked] = useState(false);
  const [serverSeedHash, setServerSeedHash] = useState("");
  const [roundId, setRoundId] = useState(null);
  const [history, setHistory] = useState([]);
  const focusRef = useRef(null);

  useEffect(() => { if (focusRef.current) focusRef.current.focus(); }, [active]);

  const tilesLeft = 25 - safeRevealed;
  const currentMult = fairMultiplier({ tiles: 25, mines, safeRevealed, houseEdge });
  const potentialPayout = (bet * currentMult).toFixed(2);

  async function prepareBoard() {
    const indices = Array.from({ length: 25 }, (_, i) => i);
    const perm = await seededShuffle(indices, seeds);
    const mineSet = new Set(perm.slice(0, mines));
    return Array.from({ length: 25 }, (_, i) => ({ revealed: false, isMine: mineSet.has(i) }));
  }

  async function startRound() {
    if (bet < minBet || bet > maxBet) return alert(`Bet must be between ${minBet} and ${maxBet}.`);
    const newSeeds = { ...seeds, nonce: Number(seeds.nonce) || 1 };
    setSeeds(newSeeds);

    let rid = null; let hash = "";
    if (onPlaceBet) {
      try {
        const resp = await onPlaceBet(bet, mines, newSeeds);
        rid = resp?.roundId ?? null;
        hash = resp?.serverSeedHash ?? "";
      } catch { /* demo mode */ }
    } else {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(newSeeds.serverSeed));
      hash = bufferToHex(digest);
    }
    setRoundId(rid); setServerSeedHash(hash);

    const b = await prepareBoard();
    setGrid(b); setActive(true); setBusted(false); setSafeRevealed(0); setCashoutLocked(false);
  }

  async function endRound(cashedOut) {
    setActive(false); setCashoutLocked(true);
    let revealedServerSeed = seeds.serverSeed;
    if (onResolve && roundId) {
      try { const resp = await onResolve(roundId); revealedServerSeed = resp?.serverSeed ?? seeds.serverSeed; } catch {}
    }
    setHistory((h) => [
      {
        ts: new Date().toISOString(), bet, mines,
        result: busted ? "LOSS" : cashedOut ? "CASHOUT" : "END",
        safe: safeRevealed, mult: Number(currentMult.toFixed(4)),
        payout: busted ? 0 : cashedOut ? Number((bet * currentMult).toFixed(2)) : 0,
        seeds: { ...seeds, serverSeed: revealedServerSeed }, serverSeedHash,
        layout: grid.map((t) => (t.isMine ? 1 : 0)),
      },
      ...h.slice(0, 9),
    ]);
  }

  function resetRound() {
    setActive(false); setBusted(false); setSafeRevealed(0); setCashoutLocked(false);
    setGrid(Array.from({ length: 25 }, () => ({ revealed: false, isMine: false })));
  }

  async function onTileClick(idx) {
    if (!active || cashoutLocked) return;
    const cell = grid[idx];
    if (cell.revealed) return;

    const newGrid = grid.slice();
    newGrid[idx] = { ...cell, revealed: true };

    if (cell.isMine) {
      setGrid(newGrid); setBusted(true);
      await new Promise((r) => setTimeout(r, 220));
      setGrid((g) => g.map((c) => (c.isMine ? { ...c, revealed: true } : c)));
      endRound(false);
    } else {
      setGrid(newGrid); setSafeRevealed((s) => s + 1);
      if (safeRevealed + 1 >= 25 - mines) endRound(true);
    }
  }

  function onKeyDown(e) {
    if (!active) return;
    const focus = document.activeElement;
    const idx = Number(focus?.getAttribute?.("data-idx"));
    if (Number.isNaN(idx)) return;
    const row = Math.floor(idx / 5); const col = idx % 5;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onTileClick(idx); }
    else if (e.key === "ArrowRight" && col < 4) document.querySelector(`[data-idx="${idx + 1}"]`)?.focus();
    else if (e.key === "ArrowLeft" && col > 0) document.querySelector(`[data-idx="${idx - 1}"]`)?.focus();
    else if (e.key === "ArrowDown" && row < 4) document.querySelector(`[data-idx="${idx + 5}"]`)?.focus();
    else if (e.key === "ArrowUp" && row > 0) document.querySelector(`[data-idx="${idx - 5}"]`)?.focus();
  }

  // --- palette approximating Stake ---
  const c = {
    appBg: "#0f212e",
    panel: "#1a2c38",
    panelSoft: "#152532",
    tile: "#213743",
    tileHover: "#2a4152",
    tileSafe: "#1f3a46",
    tileMine: "#3a2328",
    border: "#2a4152",
    text: "#d7e1ea",
    subtext: "#91a3b0",
    accent: "#00e701", // Stake green
    accentHover: "#00c800",
    blueBtn: "#0d5bd6",
  };

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: c.appBg, color: c.text }}>
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4 md:gap-6">
          {/* LEFT: Controls */}
          <aside className="rounded-xl border" style={{ backgroundColor: c.panel, borderColor: c.border }}>
            <div className="p-4 md:p-5">
              {/* Segmented control */}
              <div className="flex bg-[#0b1a23] rounded-full p-1 mb-4 w-fit">
                <button className="px-4 py-1.5 text-sm rounded-full" style={{ backgroundColor: c.panel, color: c.text }}>Manual</button>
                <button className="px-4 py-1.5 text-sm rounded-full text-[#7b8b97]">Auto</button>
              </div>

              {/* Bet */}
              <label className="text-xs" style={{ color: c.subtext }}>Bet Amount</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="number"
                  min={minBet}
                  max={maxBet}
                  step="0.00000001"
                  value={bet}
                  disabled={active}
                  onChange={(e) => setBet(Number(e.target.value))}
                  className="flex-1 rounded-lg px-3 py-2 outline-none text-sm"
                  style={{ backgroundColor: c.panelSoft, borderColor: c.border, borderWidth: 1 }}
                />
                <div className="flex items-center gap-1">
                  <button onClick={() => setBet((b) => Math.max(minBet, Number((b/2).toFixed(8))))} className="px-2 py-2 rounded-lg text-sm" style={{ backgroundColor: c.panelSoft, borderColor: c.border, borderWidth: 1 }}>½</button>
                  <button onClick={() => setBet((b) => Math.min(maxBet, Number((b*2).toFixed(8))))} className="px-2 py-2 rounded-lg text-sm" style={{ backgroundColor: c.panelSoft, borderColor: c.border, borderWidth: 1 }}>2×</button>
                </div>
              </div>
              <p className="text-[11px] mt-1" style={{ color: c.subtext }}>Min {minBet} • Max {maxBet}</p>

              {/* Mines */}
              <div className="mt-4">
                <label className="text-xs" style={{ color: c.subtext }}>Mines</label>
                <div className="mt-1">
                  <select
                    value={mines}
                    disabled={active}
                    onChange={(e) => setMines(Number(e.target.value))}
                    className="w-full rounded-lg px-3 py-2 outline-none text-sm"
                    style={{ backgroundColor: c.panelSoft, borderColor: c.border, borderWidth: 1 }}
                  >
                    {Array.from({ length: 24 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Bet / Cashout */}
              <div className="mt-4">
                {!active ? (
                  <button onClick={startRound} className="w-full font-semibold rounded-lg py-3" style={{ backgroundColor: c.accent, color: "#001b0a" }}>
                    Bet
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => endRound(true)} disabled={safeRevealed === 0 || busted} className="flex-1 font-semibold rounded-lg py-3 disabled:opacity-60" style={{ backgroundColor: c.accent, color: "#001b0a" }}>
                      Cash Out
                    </button>
                    <button onClick={resetRound} className="px-4 rounded-lg" style={{ backgroundColor: c.panelSoft, color: c.text, borderColor: c.border, borderWidth: 1 }}>
                      Reset
                    </button>
                  </div>
                )}
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-2 mt-4 text-sm">
                <div className="rounded-lg p-3" style={{ backgroundColor: c.panelSoft, borderColor: c.border, borderWidth: 1 }}>
                  <p className="text-xs" style={{ color: c.subtext }}>Current multiplier</p>
                  <p className="text-lg font-semibold">× {currentMult.toFixed(4)}</p>
                </div>
                <div className="rounded-lg p-3" style={{ backgroundColor: c.panelSoft, borderColor: c.border, borderWidth: 1 }}>
                  <p className="text-xs" style={{ color: c.subtext }}>Potential payout</p>
                  <p className="text-lg font-semibold">{potentialPayout} {currency}</p>
                </div>
              </div>

              {/* Seeds */}
              <div className="mt-4 grid grid-cols-1 gap-3">
                <div>
                  <label className="text-xs" style={{ color: c.subtext }}>Client seed</label>
                  <input
                    type="text"
                    value={seeds.clientSeed}
                    disabled={active}
                    onChange={(e) => setSeeds((s) => ({ ...s, clientSeed: e.target.value }))}
                    className="mt-1 w-full rounded-lg px-3 py-2 outline-none text-sm"
                    style={{ backgroundColor: c.panelSoft, borderColor: c.border, borderWidth: 1 }}
                  />
                </div>
                <div>
                  <label className="text-xs" style={{ color: c.subtext }}>Nonce</label>
                  <input
                    type="number"
                    min={1}
                    value={seeds.nonce}
                    disabled={active}
                    onChange={(e) => setSeeds((s) => ({ ...s, nonce: Number(e.target.value) }))}
                    className="mt-1 w-full rounded-lg px-3 py-2 outline-none text-sm"
                    style={{ backgroundColor: c.panelSoft, borderColor: c.border, borderWidth: 1 }}
                  />
                </div>
                <div>
                  <label className="text-xs" style={{ color: c.subtext }}>Server seed (demo)</label>
                  <input
                    type="text"
                    value={seeds.serverSeed}
                    disabled={active}
                    onChange={(e) => setSeeds((s) => ({ ...s, serverSeed: e.target.value }))}
                    className="mt-1 w-full rounded-lg px-3 py-2 outline-none text-sm"
                    style={{ backgroundColor: c.panelSoft, borderColor: c.border, borderWidth: 1 }}
                  />
                </div>
              </div>

              <div className="mt-4 text-[11px]" style={{ color: c.subtext }}>
                Commitment hash: <span className="font-mono break-all">{serverSeedHash || "—"}</span>
              </div>
            </div>
          </aside>

          {/* RIGHT: Game grid & info */}
          <div className="rounded-xl p-4 md:p-6 space-y-4" style={{ backgroundColor: c.panel, borderColor: c.border, borderWidth: 1 }}>
            <div className="grid grid-cols-5 gap-3 outline-none" tabIndex={0} onKeyDown={onKeyDown} ref={focusRef}>
              {grid.map((cell, i) => (
                <button
                  key={i}
                  data-idx={i}
                  onClick={() => onTileClick(i)}
                  className="relative aspect-square rounded-xl border flex items-center justify-center"
                  style={{
                    backgroundColor: cell.revealed ? (cell.isMine ? c.tileMine : c.tileSafe) : c.tile,
                    borderColor: c.border,
                  }}
                >
                  <AnimatePresence>
                    {cell.revealed && (
                      <motion.div
                        initial={{ scale: 0.85, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 260, damping: 20 }}
                        className="flex items-center justify-center"
                        style={{ color: cell.isMine ? "#ff8787" : c.text }}
                      >
                        {cell.isMine ? <Bomb className="w-7 h-7" /> : <Diamond />}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>
              ))}
            </div>

            {/* Round summary */}
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

            {/* History */}
            <div className="rounded-xl p-4" style={{ backgroundColor: c.panelSoft, borderColor: c.border, borderWidth: 1 }}>
              <h2 className="text-sm font-semibold mb-3">Recent</h2>
              <div className="space-y-2 max-h-[280px] overflow-auto pr-1">
                {history.length === 0 && (
                  <p className="text-xs" style={{ color: c.subtext }}>No rounds yet.</p>
                )}
                {history.map((h, i) => (
                  <div key={i} className="rounded-lg p-3" style={{ backgroundColor: c.panel, borderColor: c.border, borderWidth: 1 }}>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        {h.result === "LOSS" ? <Bomb className="w-4 h-4" /> : <Diamond />}
                        <span className="font-medium">{h.result}</span>
                        <span className="opacity-70">• {new Date(h.ts).toLocaleTimeString()}</span>
                      </div>
                      <div className="text-right">
                        <div>× {h.mult.toFixed(4)}</div>
                        <div className="text-xs opacity-80">{h.payout.toFixed(2)} {currency}</div>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-5 gap-1">
                      {h.layout.map((m, idx) => (
                        <div key={idx} className="aspect-square rounded-md" style={{ backgroundColor: m ? c.tileMine : c.tileSafe }}></div>
                      ))}
                    </div>
                    <details className="mt-2 text-xs opacity-80">
                      <summary className="cursor-pointer">Seeds</summary>
                      <div className="font-mono break-all mt-1">
                        <div><strong>serverSeedHash:</strong> {h.serverSeedHash}</div>
                        <div><strong>serverSeed:</strong> {h.seeds.serverSeed}</div>
                        <div><strong>clientSeed:</strong> {h.seeds.clientSeed}</div>
                        <div><strong>nonce:</strong> {h.seeds.nonce}</div>
                      </div>
                    </details>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[11px] opacity-80">
              In production, the server provides a serverSeed <em>hash</em> before play and reveals the
              serverSeed after the round for verification. PRNG: HMAC-SHA256(serverSeed, `server:client:nonce:cursor`).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}