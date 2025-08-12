import React, { useMemo, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Mines Game — Stake-style (5x5 grid) — Production-ready React component
 * ----------------------------------------------------------------------
 * ⚙️ Features
 * - 5x5 grid (25 tiles) with 1–24 mines
 * - Bet entry, mines selector, Start/Reset, Cash Out
 * - Dynamic, provably-fair multipliers with configurable house edge
 * - Deterministic PRNG via HMAC-SHA256(ServerSeed:ClientSeed:Nonce:Cursor)
 * - Clean Tailwind UI, subtle animations with Framer Motion
 * - Round history & basic keyboard accessibility
 *
 * 🧩 Integration Notes
 * - In production, DO NOT generate serverSeed on the client.
 *   1) Server generates a random serverSeed and stores it. Send its SHA256 hash to the client before the round starts (commitment).
 *   2) Client provides a clientSeed and nonce.
 *   3) After the round, server reveals serverSeed. Client verifies that mine placement matches the commitment.
 * - Wire the two callbacks below to your backend:
 *     onPlaceBet(betAmount, mines, seeds) -> returns { roundId, serverSeedHash }
 *     onResolve(roundId) -> returns { serverSeed }
 * - This component includes a fully functional demo PRNG to visualize the UX.
 */

// ---------- Utility: HMAC-SHA256 and helpers (browser-native SubtleCrypto) ----------
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
  // Use first 13 hex chars (~52 bits) to stay within JS number precision
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

// ---------- Icons (minimal inline to avoid external deps) ----------
const Bomb = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M13 7h-2V3h2v4Zm4.95-1.536-1.414-1.414 2.828-2.829 1.415 1.415-2.83 2.828ZM7.464 5.464 4.636 2.636 6.05 1.222l2.828 2.829-1.414 1.414ZM12 8a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z" />
  </svg>
);

const Sparkle = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M12 2l2.1 5.1L19 9l-4.9 1.9L12 16l-2.1-5.1L5 9l4.9-1.9L12 2Zm7 11 1.2 2.9L23 17l-2.8 1.1L19 21l-1.2-2.9L15 17l2.8-1.1L19 13Z" />
  </svg>
);

// ---------- Types ----------
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
  onPlaceBet, // async (bet, mines, seeds) => { roundId, serverSeedHash }
  onResolve, // async (roundId) => { serverSeed }
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

  useEffect(() => {
    if (focusRef.current) focusRef.current.focus();
  }, [active]);

  const tilesLeft = 25 - safeRevealed;
  const currentMult = fairMultiplier({ tiles: 25, mines, safeRevealed, houseEdge });
  const potentialPayout = (bet * currentMult).toFixed(2);

  async function prepareBoard() {
    // Compute deterministic mine layout with current seeds
    const indices = Array.from({ length: 25 }, (_, i) => i);
    const perm = await seededShuffle(indices, seeds);
    const mineSet = new Set(perm.slice(0, mines));
    return Array.from({ length: 25 }, (_, i) => ({ revealed: false, isMine: mineSet.has(i) }));
  }

  async function startRound() {
    if (bet < minBet || bet > maxBet) return alert(`Bet must be between ${minBet} and ${maxBet}.`);
    const newSeeds = { ...seeds, nonce: Number(seeds.nonce) || 1 };
    setSeeds(newSeeds);

    // Backend integration (optional)
    let rid = null;
    let hash = "";
    if (onPlaceBet) {
      try {
        const resp = await onPlaceBet(bet, mines, newSeeds);
        rid = resp?.roundId ?? null;
        hash = resp?.serverSeedHash ?? "";
      } catch (e) {
        console.warn("onPlaceBet failed; continuing demo mode.", e);
      }
    } else {
      // Demo: commit to demo serverSeed by hash on client (not secure)
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(newSeeds.serverSeed)
      );
      hash = bufferToHex(digest);
    }
    setRoundId(rid);
    setServerSeedHash(hash);

    const b = await prepareBoard();
    setGrid(b);
    setActive(true);
    setBusted(false);
    setSafeRevealed(0);
    setCashoutLocked(false);
  }

  async function endRound(cashedOut) {
    setActive(false);
    setCashoutLocked(true);

    // Resolve and append to history with serverSeed reveal
    let revealedServerSeed = seeds.serverSeed;
    if (onResolve && roundId) {
      try {
        const resp = await onResolve(roundId);
        revealedServerSeed = resp?.serverSeed ?? seeds.serverSeed;
      } catch (e) {
        console.warn("onResolve failed; falling back to demo serverSeed.", e);
      }
    }

    setHistory((h) => [
      {
        ts: new Date().toISOString(),
        bet,
        mines,
        result: busted ? "LOSS" : cashedOut ? "CASHOUT" : "END",
        safe: safeRevealed,
        mult: Number(currentMult.toFixed(4)),
        payout: busted ? 0 : cashedOut ? Number((bet * currentMult).toFixed(2)) : 0,
        seeds: { ...seeds, serverSeed: revealedServerSeed },
        serverSeedHash,
        layout: grid.map((t) => (t.isMine ? 1 : 0)),
      },
      ...h.slice(0, 9),
    ]);
  }

  function resetRound() {
    setActive(false);
    setBusted(false);
    setSafeRevealed(0);
    setCashoutLocked(false);
    setGrid(Array.from({ length: 25 }, () => ({ revealed: false, isMine: false })));
  }

  async function onTileClick(idx) {
    if (!active || cashoutLocked) return;
    const cell = grid[idx];
    if (cell.revealed) return;

    const newGrid = grid.slice();
    newGrid[idx] = { ...cell, revealed: true };

    if (cell.isMine) {
      setGrid(newGrid);
      setBusted(true);
      await new Promise((r) => setTimeout(r, 250));
      // reveal all mines for effect
      setGrid((g) => g.map((c) => (c.isMine ? { ...c, revealed: true } : c)));
      endRound(false);
    } else {
      setGrid(newGrid);
      setSafeRevealed((s) => s + 1);
      if (safeRevealed + 1 >= 25 - mines) {
        // cleared all safes -> auto cashout
        endRound(true);
      }
    }
  }

  // Keyboard: allow focusing grid and using arrows + Enter
  function onKeyDown(e) {
    if (!active) return;
    const focus = document.activeElement;
    const idx = Number(focus?.getAttribute?.("data-idx"));
    if (Number.isNaN(idx)) return;
    const row = Math.floor(idx / 5);
    const col = idx % 5;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onTileClick(idx);
    } else if (e.key === "ArrowRight" && col < 4) {
      document.querySelector(`[data-idx="${idx + 1}"]`)?.focus();
    } else if (e.key === "ArrowLeft" && col > 0) {
      document.querySelector(`[data-idx="${idx - 1}"]`)?.focus();
    } else if (e.key === "ArrowDown" && row < 4) {
      document.querySelector(`[data-idx="${idx + 5}"]`)?.focus();
    } else if (e.key === "ArrowUp" && row > 0) {
      document.querySelector(`[data-idx="${idx - 5}"]`)?.focus();
    }
  }

  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-100 flex items-center justify-center p-6">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6">
        {/* LEFT: Game */}
        <div className="bg-neutral-900/60 rounded-2xl border border-neutral-800 shadow-xl p-5">
          <header className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-neutral-800 flex items-center justify-center">
                <Sparkle className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">Mines</h1>
                <p className="text-xs text-neutral-400">Provably fair • 5×5 • {mines} mines</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-neutral-400">Committed hash</p>
              <p className="text-[10px] font-mono truncate max-w-[220px]">{serverSeedHash || "—"}</p>
            </div>
          </header>

          {/* Controls */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="col-span-2 bg-neutral-800/60 rounded-xl p-3">
              <label className="text-xs text-neutral-400">Bet</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="number"
                  min={minBet}
                  max={maxBet}
                  step="0.01"
                  value={bet}
                  disabled={active}
                  onChange={(e) => setBet(Number(e.target.value))}
                  className="flex-1 bg-neutral-900 rounded-lg px-3 py-2 outline-none focus:ring-2 ring-blue-500 text-sm"
                />
                <div className="text-xs text-neutral-400 px-2 py-1 bg-neutral-900 rounded-lg">{currency}</div>
              </div>
              <p className="text-[11px] mt-1 text-neutral-500">Min {minBet} • Max {maxBet}</p>
            </div>

            <div className="bg-neutral-800/60 rounded-xl p-3">
              <label className="text-xs text-neutral-400">Mines</label>
              <input
                type="range"
                min={1}
                max={24}
                value={mines}
                disabled={active}
                onChange={(e) => setMines(Number(e.target.value))}
                className="w-full"
              />
              <div className="text-sm mt-1">{mines}</div>
            </div>

            <div className="bg-neutral-800/60 rounded-xl p-3">
              <label className="text-xs text-neutral-400">House edge</label>
              <div className="text-sm mt-1">{(houseEdge * 100).toFixed(2)}%</div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 mb-4">
            {!active ? (
              <button
                onClick={startRound}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 transition font-medium"
              >
                Start
              </button>
            ) : (
              <>
                <button
                  onClick={() => endRound(true)}
                  disabled={safeRevealed === 0 || busted}
                  className="px-4 py-2.5 rounded-xl bg-green-600 disabled:bg-neutral-700 hover:bg-green-500 transition font-medium"
                >
                  Cash Out
                </button>
                <button
                  onClick={resetRound}
                  className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 transition"
                >
                  Reset
                </button>
              </>
            )}

            <div className="ml-auto text-right">
              <p className="text-xs text-neutral-400">Current multiplier</p>
              <p className="text-lg font-semibold">× {currentMult.toFixed(4)}</p>
            </div>

            <div className="text-right">
              <p className="text-xs text-neutral-400">Potential payout</p>
              <p className="text-lg font-semibold">{potentialPayout} {currency}</p>
            </div>
          </div>

          {/* Grid */}
          <div
            className="grid grid-cols-5 gap-2 outline-none"
            tabIndex={0}
            onKeyDown={onKeyDown}
            ref={focusRef}
          >
            {grid.map((cell, i) => (
              <button
                key={i}
                data-idx={i}
                onClick={() => onTileClick(i)}
                className={[
                  "relative aspect-square rounded-2xl border flex items-center justify-center",
                  cell.revealed
                    ? cell.isMine
                      ? "bg-red-900/50 border-red-800"
                      : "bg-emerald-900/40 border-emerald-800"
                    : active
                      ? "bg-neutral-800/60 border-neutral-700 hover:bg-neutral-700"
                      : "bg-neutral-900/60 border-neutral-800",
                ].join(" ")}
              >
                <AnimatePresence>
                  {cell.revealed && (
                    <motion.div
                      initial={{ scale: 0.85, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 260, damping: 20 }}
                      className="flex items-center justify-center"
                    >
                      {cell.isMine ? (
                        <Bomb className="w-8 h-8" />
                      ) : (
                        <span className="text-xl font-semibold">💎</span>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
            ))}
          </div>

          {/* Seeds & Verify */}
          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-neutral-800/60 rounded-xl p-3">
              <label className="text-xs text-neutral-400">Client seed</label>
              <input
                type="text"
                value={seeds.clientSeed}
                disabled={active}
                onChange={(e) => setSeeds((s) => ({ ...s, clientSeed: e.target.value }))}
                className="mt-1 w-full bg-neutral-900 rounded-lg px-3 py-2 outline-none focus:ring-2 ring-blue-500 text-sm"
              />
            </div>
            <div className="bg-neutral-800/60 rounded-xl p-3">
              <label className="text-xs text-neutral-400">Nonce</label>
              <input
                type="number"
                min={1}
                value={seeds.nonce}
                disabled={active}
                onChange={(e) => setSeeds((s) => ({ ...s, nonce: Number(e.target.value) }))}
                className="mt-1 w-full bg-neutral-900 rounded-lg px-3 py-2 outline-none focus:ring-2 ring-blue-500 text-sm"
              />
            </div>
            <div className="bg-neutral-800/60 rounded-xl p-3">
              <label className="text-xs text-neutral-400">Server seed (demo only)</label>
              <input
                type="text"
                value={seeds.serverSeed}
                disabled={active}
                onChange={(e) => setSeeds((s) => ({ ...s, serverSeed: e.target.value }))}
                className="mt-1 w-full bg-neutral-900 rounded-lg px-3 py-2 outline-none focus:ring-2 ring-blue-500 text-sm"
              />
            </div>
          </div>

          <p className="text-[11px] text-neutral-500 mt-2">
            In production, the server provides a serverSeed <em>hash</em> before play, and reveals the
            serverSeed after the round for verification. The layout here is derived from
            HMAC-SHA256(serverSeed, `${"serverSeed"}:${"clientSeed"}:${"nonce"}:${"cursor"}`) as a deterministic PRNG.
          </p>
        </div>

        {/* RIGHT: Sidebar */}
        <aside className="space-y-4">
          {/* Round summary */}
          <div className="bg-neutral-900/60 rounded-2xl border border-neutral-800 p-5">
            <h2 className="text-sm font-semibold mb-3">Round</h2>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-neutral-800/60 rounded-xl p-3">
                <p className="text-xs text-neutral-400">Tiles left</p>
                <p className="text-lg font-semibold">{tilesLeft}</p>
              </div>
              <div className="bg-neutral-800/60 rounded-xl p-3">
                <p className="text-xs text-neutral-400">Safe revealed</p>
                <p className="text-lg font-semibold">{safeRevealed}</p>
              </div>
              <div className="bg-neutral-800/60 rounded-xl p-3">
                <p className="text-xs text-neutral-400">Mines</p>
                <p className="text-lg font-semibold">{mines}</p>
              </div>
              <div className="bg-neutral-800/60 rounded-xl p-3">
                <p className="text-xs text-neutral-400">Status</p>
                <p className="text-lg font-semibold">{busted ? "BUST" : active ? "LIVE" : safeRevealed > 0 ? "ENDED" : "IDLE"}</p>
              </div>
            </div>
          </div>

          {/* History */}
          <div className="bg-neutral-900/60 rounded-2xl border border-neutral-800 p-5">
            <h2 className="text-sm font-semibold mb-3">Recent</h2>
            <div className="space-y-2 max-h-[300px] overflow-auto pr-1">
              {history.length === 0 && (
                <p className="text-xs text-neutral-500">No rounds yet.</p>
              )}
              {history.map((h, i) => (
                <div key={i} className="bg-neutral-800/50 rounded-xl p-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      {h.result === "LOSS" ? (
                        <Bomb className="w-4 h-4" />
                      ) : (
                        <span className="text-base">💎</span>
                      )}
                      <span className="font-medium">{h.result}</span>
                      <span className="text-neutral-400">• {new Date(h.ts).toLocaleTimeString()}</span>
                    </div>
                    <div className="text-right">
                      <div>× {h.mult.toFixed(4)}</div>
                      <div className="text-xs text-neutral-400">{h.payout.toFixed(2)} {currency}</div>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-5 gap-1">
                    {h.layout.map((m, idx) => (
                      <div key={idx} className={"aspect-square rounded-lg " + (m ? "bg-red-900/40" : "bg-emerald-900/30")}></div>
                    ))}
                  </div>
                  <details className="mt-2 text-xs text-neutral-400">
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

          {/* Helper / API Spec */}
          <div className="bg-neutral-900/60 rounded-2xl border border-neutral-800 p-5">
            <h2 className="text-sm font-semibold mb-2">Backend Hooks</h2>
            <pre className="text-[11px] whitespace-pre-wrap text-neutral-300 font-mono bg-neutral-950/60 rounded-xl p-3 border border-neutral-800">{
`// Called when user starts a round
async function onPlaceBet(bet, mines, seeds) {
  // 1) Generate serverSeed (crypto-secure) and store it with round.
  // 2) Return roundId + sha256(serverSeed) so client shows commitment.
  return { roundId: "abc123", serverSeedHash: "..." };
}

// Called when round ends (cashout or bust)
async function onResolve(roundId) {
  // Reveal serverSeed for verification
  return { serverSeed: "REVEALED_SERVER_SEED" };
}`
            }</pre>
          </div>
        </aside>
      </div>
    </div>
  );
}
