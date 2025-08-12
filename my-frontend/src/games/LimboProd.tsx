import React, { useMemo, useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCurrency } from "../context/CurrencyContext";

type Seeds = { serverSeed: string; clientSeed: string; nonce: number };
type PlaceBetResp = {
  roundId?: string;
  serverSeedHash?: string;
  clientSeed?: string;
  nonce?: number;
};
type ResolveResp = {
  serverSeed: string;
  resultMultiplier: number;
  didWin: boolean;
  payout: number;
};

const MIN_TARGET = 1.01;
const MAX_TARGET = 1_000_000;
const DEFAULT_SEEDS: Seeds = { serverSeed: "", clientSeed: "", nonce: 1 };
const PRESETS = [1.5, 2, 5, 10, 100];

// label formatter just for the UI (keeps dot-decimals internally)
const presetLabel = (v: number) =>
  `×${Number.isInteger(v) ? String(v) : v.toFixed(2).replace(".", ",")}`;

// ---- time helpers for animation ----
function desiredTimeFor(finalM: number) {
  const l = Math.log(Math.max(1.0001, finalM));
  return Math.max(1.2, Math.min(5.0, 0.9 + 0.55 * l)); // ~1.3s @2x, ~2.1s @10x, ~4.7s @1000x
}

export default function LimboProd({
  houseEdge = 0.01,
  minBet = 0,
  maxBet = 1000,
  onPlaceBet,
  onResolve,
}: {
  houseEdge?: number;
  minBet?: number;
  maxBet?: number;
  onPlaceBet?: (
    bet: number,
    params: { target: number; currency: "BTC" | "SOL" },
    seeds: { clientSeed: string; nonce: number }
  ) => Promise<PlaceBetResp>;
  onResolve?: (roundId: string) => Promise<ResolveResp>;
}) {
  const { selectedCurrency, adjustBalance } = useCurrency();

  // skin
  const c = useMemo(
    () => ({
      appBg: "#1a2c38",
      panel: "#0f212e",
      panelSoft: "#152532",
      border: "#2a4152",
      text: "#d7e1ea",
      subtext: "#91a3b0",
      accent: "#00e701",
      accentText: "#001b0a",
      red: "#ff5757",
      green: "#00d463",
    }),
    []
  );

  // state
  const [bet, setBet] = useState(0);
  const [target, setTarget] = useState(2.0);
  const [betField, setBetField] = useState(minBet.toFixed(8));
  const [targetField, setTargetField] = useState(target.toFixed(2));
  const [editingBet, setEditingBet] = useState(false);
  const [editingTarget, setEditingTarget] = useState(false);

  const [rolling, setRolling] = useState(false);
  const [seeds, setSeeds] = useState<Seeds>(DEFAULT_SEEDS);
  const [serverSeedHash, setServerSeedHash] = useState("");
  const [roundId, setRoundId] = useState<string | null>(null);

  const [lastMult, setLastMult] = useState<number | null>(null);
  const [lastWin, setLastWin] = useState<boolean | null>(null);
  const [recent, setRecent] = useState<{ m: number; w: boolean }[]>([]);

  // BIG number animation
  const [displayMult, setDisplayMult] = useState(1.0);
  const [displayColor, setDisplayColor] = useState<"white" | "green" | "red">(
    "white"
  );
  const rafRef = useRef<number | null>(null);
  const stopAnim = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  const animateTo = (finalM: number, targetM: number) => {
    stopAnim();
    setDisplayMult(1.0);
    setDisplayColor("white");

    const duration = desiredTimeFor(finalM);
    const start = performance.now();
    const rate = Math.log(finalM) / duration; // m(t) = exp(rate*t), t in seconds

    const tick = (now: number) => {
      const t = (now - start) / 1000;
      let m = Math.exp(rate * Math.max(0, t));
      if (!Number.isFinite(m)) m = finalM;

      if (m >= finalM) {
        setDisplayMult(finalM);
        setDisplayColor(finalM >= targetM ? "green" : "red");
        rafRef.current = null;
        return;
      }

      if (finalM >= targetM && m >= targetM && displayColor !== "green") {
        setDisplayColor("green");
      }

      setDisplayMult(m);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  };

  // derived
  const winChance = useMemo(() => {
    const ch = (100 * (1 - houseEdge)) / Math.max(1.0001, target);
    return Math.max(0.01, Math.min(99.99, ch));
  }, [target, houseEdge]);

  const profitOnWin = useMemo(() => Math.max(0, bet * target - bet), [bet, target]);

  useEffect(() => {
    if (!editingBet) setBetField(bet.toFixed(8));
  }, [bet, editingBet]);
  useEffect(() => {
    if (!editingTarget) setTargetField(target.toFixed(2));
  }, [target, editingTarget]);

  function stepBet(k: number) {
    setEditingBet(false);
    setBet((b) => {
      const next = Math.min(Math.max(Number((b * k).toFixed(8)), minBet), maxBet);
      setBetField(next.toFixed(8));
      return next;
    });
  }

  async function startRound() {
    if (bet !== 0 && (bet < minBet || bet > maxBet)) {
      alert(`Bet must be between ${minBet} and ${maxBet}.`);
      return;
    }
    if (target < MIN_TARGET || target > MAX_TARGET) {
	  alert(`Target must be between ${MIN_TARGET}× and ${MAX_TARGET.toLocaleString()}×`);
	  return;
	}

    setRolling(true);
    stopAnim();
    setDisplayMult(1.0);
    setDisplayColor("white");

    // prepare seeds (serverSeed arrives on resolve)
    let seedsForRoll = { ...seeds, nonce: Number(seeds.nonce) || 1 };
    if (!seedsForRoll.clientSeed) {
      seedsForRoll.clientSeed = crypto
        .getRandomValues(new Uint8Array(16))
        .reduce((acc, v) => acc + v.toString(16).padStart(2, "0"), "");
    }
    setSeeds(seedsForRoll);

    try {
      if (!onPlaceBet || !onResolve) {
        alert("Missing handlers.");
        return;
      }

      // PLACE
      const resp = await onPlaceBet(
        bet,
        { target, currency: selectedCurrency as "BTC" | "SOL" },
        seedsForRoll
      );

      if (resp?.roundId && bet > 0) {
        adjustBalance(selectedCurrency, -bet); // reserve
      }
      if (resp?.clientSeed || resp?.nonce) {
        seedsForRoll = {
          ...seedsForRoll,
          clientSeed: resp?.clientSeed ?? seedsForRoll.clientSeed,
          nonce: resp?.nonce ?? seedsForRoll.nonce,
        };
        setSeeds((prev) => ({
          ...prev,
          clientSeed: seedsForRoll.clientSeed,
          nonce: seedsForRoll.nonce,
        }));
      }
      setRoundId(resp?.roundId ?? null);
      setServerSeedHash(resp?.serverSeedHash ?? "");

      // RESOLVE
      if (resp?.roundId) {
        const fin = await onResolve(resp.roundId);

        if (fin?.serverSeed) {
          setSeeds((prev) => ({ ...prev, serverSeed: fin.serverSeed }));
        }

        animateTo(fin.resultMultiplier, target);

        setLastMult(fin.resultMultiplier);
        setLastWin(fin.didWin === true);
        setRecent((r) => [{ m: fin.resultMultiplier, w: !!fin.didWin }, ...r].slice(0, 10));

        if (fin?.payout && fin.payout > 0) {
          adjustBalance(selectedCurrency, fin.payout);
        }
      }
    } catch (e: any) {
      console.warn("limbo startRound error:", e);
      alert(e?.message || "Bet failed. Please try again.");
    } finally {
      setRolling(false);
    }
  }

  useEffect(() => () => stopAnim(), []); // cleanup on unmount

  const decimals = displayMult >= 100 ? 0 : displayMult >= 10 ? 2 : 2;
  const bigColor =
    displayColor === "green" ? c.green : displayColor === "red" ? c.red : "#e6f0f7";

  return (
    <div className="w-full" style={{ backgroundColor: c.appBg, color: c.text }}>
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4 md:gap-6">
          {/* LEFT PANEL */}
          <aside
            className="rounded-xl border h-fit"
            style={{ backgroundColor: c.panel, borderColor: c.border }}
          >
            <div className="p-4 md:p-5">
              <label className="text-xs" style={{ color: c.subtext }}>
                Bet Amount
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={betField}
                  onFocus={() => setEditingBet(true)}
                  onChange={(e) => {
                    let raw = e.target.value.replace(",", ".").replace(/[^0-9.]/g, "");
                    const parts = raw.split(".");
                    if (parts.length > 2) raw = parts[0] + "." + parts.slice(1).join("");
                    setBetField(raw);
                    const parsed = parseFloat(raw);
                    if (!Number.isNaN(parsed))
                      setBet(Math.min(Math.max(parsed, minBet), maxBet));
                  }}
                  onBlur={() => {
					  setEditingTarget(false);
					  const parsed = Number(targetField.replace(",", "."));
					  const clamped = Number.isFinite(parsed)
						? Math.min(Math.max(parsed, MIN_TARGET), MAX_TARGET)
						: target;
					  setTarget(clamped);
					  setTargetField(clamped.toFixed(2));
					}}
                  className="flex-1 rounded-lg px-3 py-2 outline-none text-sm"
                  style={{
                    backgroundColor: c.panelSoft,
                    borderColor: c.border,
                    borderWidth: 1,
                  }}
                />
                <div className="flex gap-1">
                  <button
                    onClick={() => stepBet(0.5)}
                    className="px-2 py-2 rounded-lg text-sm"
                    style={{
                      backgroundColor: c.panelSoft,
                      borderColor: c.border,
                      borderWidth: 1,
                    }}
                  >
                    ½
                  </button>
                  <button
                    onClick={() => stepBet(2)}
                    className="px-2 py-2 rounded-lg text-sm"
                    style={{
                      backgroundColor: c.panelSoft,
                      borderColor: c.border,
                      borderWidth: 1,
                    }}
                  >
                    2×
                  </button>
                </div>
              </div>
              <p className="text-[11px] mt-1" style={{ color: c.subtext }}>
                Min {minBet} • Max {maxBet}
              </p>

              <div className="mt-4 grid grid-cols-1 gap-3">
                <div>
                  <label className="text-xs" style={{ color: c.subtext }}>
                    Target (×)
                  </label>
                  <input
                    type="text"
                    value={targetField}
                    onFocus={() => setEditingTarget(true)}
                    onChange={(e) => {
                      const raw = e.target.value.replace(",", ".");
                      if (/^\d{0,7}(?:\.\d{0,2})?$/.test(raw)) setTargetField(raw);
                    }}
                    onBlur={() => {
                      setEditingTarget(false);
                      const parsed = Number(targetField.replace(",", "."));
                      const safe = Number.isFinite(parsed) ? Math.max(1.0001, parsed) : target;
                      setTarget(safe);
                      setTargetField(safe.toFixed(2));
                    }}
                    className="w-full rounded-lg px-3 py-2 outline-none text-sm"
                    style={{
                      backgroundColor: c.panelSoft,
                      borderColor: c.border,
                      borderWidth: 1,
                    }}
                  />
                </div>

                {/* preset targets */}
                <div className="flex gap-1 flex-nowrap overflow-x-auto">
                  {PRESETS.map((v) => {
                    const active = Math.abs(target - v) < 1e-9;
                    return (
                      <button
                        key={v}
                        disabled={rolling}
                        onClick={() => {
                          setTarget(v);
                          setTargetField(v.toFixed(2));
                        }}
                        className="rounded-full px-3 py-1 text-sm font-semibold leading-none transition"
                        style={{
                          backgroundColor: active ? c.accent : "#2e4250",
                          color: active ? "#032a14" : "#e0edf6",
                          opacity: rolling ? 0.7 : 1,
                          whiteSpace: "nowrap",
                        }}
                        title={`Target ${v}×`}
                      >
                        {presetLabel(v)}
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div
                    className="rounded-lg p-3"
                    style={{
                      backgroundColor: c.panelSoft,
                      borderColor: c.border,
                      borderWidth: 1,
                    }}
                  >
                    <p className="text-xs" style={{ color: c.subtext }}>
                      Win chance
                    </p>
                    <p className="text-lg font-semibold">{winChance.toFixed(2)}%</p>
                  </div>
                  <div
                    className="rounded-lg p-3"
                    style={{
                      backgroundColor: c.panelSoft,
                      borderColor: c.border,
                      borderWidth: 1,
                    }}
                  >
                    <p className="text-xs" style={{ color: c.subtext }}>
                      Profit on win
                    </p>
                    <p className="text-lg font-semibold">{profitOnWin.toFixed(8)}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <button
                  onClick={startRound}
                  disabled={rolling}
                  className="w-full font-semibold rounded-lg py-3 disabled:opacity-60"
                  style={{ backgroundColor: c.accent, color: c.accentText }}
                >
                  {rolling ? "Rolling…" : "Bet"}
                </button>
              </div>

              {/* Seeds & hash */}
              <div className="mt-4 grid grid-cols-1 gap-3">
                <div>
                  <label className="text-xs" style={{ color: c.subtext }}>
                    Client seed
                  </label>
                  <input
                    readOnly
                    value={seeds.clientSeed}
                    className="mt-1 w-full rounded-lg px-3 py-2 outline-none text-sm"
                    style={{
                      backgroundColor: c.panelSoft,
                      borderColor: c.border,
                      borderWidth: 1,
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs" style={{ color: c.subtext }}>
                    Nonce
                  </label>
                  <input
                    readOnly
                    value={seeds.nonce}
                    className="mt-1 w-full rounded-lg px-3 py-2 outline-none text-sm"
                    style={{
                      backgroundColor: c.panelSoft,
                      borderColor: c.border,
                      borderWidth: 1,
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs" style={{ color: c.subtext }}>
                    Server seed
                  </label>
                  <input
                    readOnly
                    value={seeds.serverSeed}
                    className="mt-1 w-full rounded-lg px-3 py-2 outline-none text-sm"
                    style={{
                      backgroundColor: c.panelSoft,
                      borderColor: c.border,
                      borderWidth: 1,
                    }}
                  />
                </div>
              </div>
              <div className="mt-2 text-[11px]" style={{ color: c.subtext }}>
                Commitment hash:{" "}
                <span className="font-mono break-all">{serverSeedHash || "—"}</span>
              </div>
            </div>
          </aside>

          {/* RIGHT: big multiplier like Stake */}
          <div
            className="rounded-xl p-4 md:p-6 space-y-6 flex flex-col"
            style={{ backgroundColor: c.panel, borderColor: c.border, borderWidth: 1 }}
          >
            {/* recent pills */}
            <div className="flex flex-wrap gap-2">
              {recent.length === 0 && (
                <div className="text-sm opacity-70">No recent bets</div>
              )}
              {recent.map((r, i) => (
                <div
                  key={i}
                  className="rounded-full px-3 py-1 text-sm font-semibold leading-none"
                  style={{
                    backgroundColor: r.w ? c.accent : "#2e4250",
                    color: r.w ? "#032a14" : "#e0edf6",
                    boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.12)",
                  }}
                  title={r.w ? "WIN" : "LOSS"}
                >
                  ×{r.m.toFixed(2)}
                </div>
              ))}
            </div>

            {/* BIG number */}
            <div className="flex-1 flex items-center justify-center">
              <motion.div
                key={`${displayColor}`}
                initial={{ scale: 0.98, opacity: 0.9 }}
                animate={{ scale: 1.0, opacity: 1 }}
                transition={{ duration: 0.15 }}
                className="font-extrabold tracking-tight select-none"
                style={{
                  color: bigColor,
                  fontSize: "clamp(56px, 16vw, 140px)",
                  lineHeight: 1,
                  textShadow: "0 0 18px rgba(0,0,0,0.25)",
                }}
              >
                ×{displayMult.toFixed(decimals)}
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
