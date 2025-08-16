// src/routes/plinko.ts
import express from "express";
import crypto from "crypto";
import { PrismaClient, Prisma } from "@prisma/client";
import { authenticateToken, AuthRequest } from "../middleware/auth";

const router = express.Router();
const prisma = new PrismaClient();

const BANK_EDGE = 0.01; // orientacija; dejanski edge je v razmerjih/tablirah

// --- Provably fair helpers (enako kot Dice/Mines/...) ---
function hashServerSeed(seed: string) {
  return crypto.createHash("sha256").update(seed).digest("hex");
}
function hexToFloat01(hex: string): number {
  const slice = hex.slice(0, 13);
  const int = parseInt(slice, 16);
  const max = Math.pow(16, slice.length);
  return int / max;
}
function* hmacStream(serverSeed: string, clientSeed: string, nonce: number) {
  let cursor = 0;
  while (true) {
    const msg = `${serverSeed}:${clientSeed}:${nonce}:${cursor++}`;
    const h = crypto
      .createHmac("sha256", Buffer.from(serverSeed, "utf8"))
      .update(Buffer.from(msg, "utf8"))
      .digest("hex");
    yield hexToFloat01(h);
  }
}

/* ---------------- Plinko multipliers (Stake-like, kot na FE) ---------------- */

type Risk = "low" | "medium" | "high";

/** Stake-like bounds for center(min) and edges(max) per rows/risk */
const STAKE_RANGE: Record<Risk, Record<number, { min: number; max: number }>> = {
  low: {
    8:  { min: 0.5, max: 5.6 },
    9:  { min: 0.7, max: 5.6 },
    10: { min: 0.5, max: 8.9 },
    11: { min: 0.7, max: 8.4 },
    12: { min: 0.5, max: 10 },
    13: { min: 0.7, max: 8.1 },
    14: { min: 0.5, max: 7.1 },
    15: { min: 0.7, max: 15 },
    16: { min: 0.5, max: 16 },
  },
  medium: {
    8:  { min: 0.4, max: 13 },
    9:  { min: 0.5, max: 18 },
    10: { min: 0.4, max: 22 },
    11: { min: 0.5, max: 24 },
    12: { min: 0.3, max: 33 },
    13: { min: 0.4, max: 43 },
    14: { min: 0.2, max: 58 },
    15: { min: 0.3, max: 88 },
    16: { min: 0.3, max: 110 },
  },
  high: {
    8:  { min: 0.2, max: 29 },
    9:  { min: 0.2, max: 43 },
    10: { min: 0.2, max: 76 },
    11: { min: 0.2, max: 120 },
    12: { min: 0.2, max: 170 },
    13: { min: 0.2, max: 260 },
    14: { min: 0.2, max: 420 },
    15: { min: 0.2, max: 620 },
    16: { min: 0.2, max: 1000 },
  },
};

/** Exact 8/low row from Stake screenshot, for perfect visual match */
const LOW_8_EXACT = [5.6, 2.1, 1.1, 1.0, 0.5, 1.0, 1.1, 2.1, 5.6];

/** Shape steepness per risk (same as FE) */
const GAMMA: Record<Risk, number> = { low: 1.7, medium: 1.35, high: 1.15 };

/** Build symmetric multipliers for (rows, risk) using the same generator as FE.
 *  center = min, edges = max, exponential interpolation with GAMMA.
 */
function buildMultipliers(rows: number, risk: Risk): number[] {
  if (risk === "low" && rows === 8) return LOW_8_EXACT.slice();

  const bounds = STAKE_RANGE[risk][rows];
  if (!bounds) throw new Error("Unsupported rows/risk");

  const slots = rows + 1;
  const arr = new Array<number>(slots).fill(0);
  const { min, max } = bounds;
  const gamma = GAMMA[risk];

  const midLeft = Math.floor((slots - 1) / 2);
  const midRight = slots % 2 === 1 ? midLeft : midLeft + 1;

  // centers
  arr[midLeft] = min;
  if (midRight !== midLeft) arr[midRight] = min;

  const steps = midLeft; // distance from center to edge on one side
  for (let d = 1; d <= steps; d++) {
    const t = Math.pow(d / steps, gamma);       // 0..1 (non-linear)
    const val = min * Math.pow(max / min, t);   // grow from min to max
    arr[midLeft - d] = val;
    // keep symmetry for even/odd slot counts
    arr[midRight + (d - (slots % 2 === 1 ? 0 : 1))] = val;
  }
  // exact edges
  arr[0] = max;
  arr[slots - 1] = max;

  return arr;
}

/** Optional RTP scaling (uniform factor) – OFF by default to keep Stake look exactly.
 *  Set ENABLE_RTP_SCALING = true if you want to force EV to ≈ 0.99 for every board.
 */
const ENABLE_RTP_SCALING = true;
const RTP_TARGET = 0.99;

function comb(n: number, k: number) {
  if (k < 0 || k > n) return 0;
  if (k > n - k) k = n - k;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}
function expectedEV(table: number[]) {
  const rows = table.length - 1;
  const denom = Math.pow(2, rows);
  let s = 0;
  for (let i = 0; i < table.length; i++) s += comb(rows, i) * table[i];
  return s / denom;
}
function scaleTable(table: number[], target = RTP_TARGET) {
  const ev = expectedEV(table);
  const f = target / Math.max(1e-12, ev);
  return table.map((m) => +(m * f));
}

/** Cache the built (and optionally scaled) tables to avoid recomputing */
const TABLE_CACHE: Record<Risk, Record<number, number[]>> = {
  low: {}, medium: {}, high: {},
};

function getTable(rows: number, risk: Risk): number[] {
  let t = TABLE_CACHE[risk][rows];
  if (!t) {
    const raw = buildMultipliers(rows, risk);
    const finalTable = ENABLE_RTP_SCALING ? scaleTable(raw) : raw;
    t = finalTable.map((x) => +x); // clone/normalize
    TABLE_CACHE[risk][rows] = t;
  }
  return t;
}

// Simuliraj spust: na vsaki stopnji izberi L/R; slots = rows+1; index = #R
function plinkoDrop(rows: number, risk: Risk, rng: Generator<number, any, any>) {
  const path: ("L"|"R")[] = [];
  let rights = 0;
  for (let i = 0; i < rows; i++) {
    const u = (rng.next().value as number) ?? Math.random();
    const dir = u < 0.5 ? "L" : "R";
    if (dir === "R") rights++;
    path.push(dir);
  }
  const table = getTable(rows, risk);
  const idx = rights; // 0..rows
  const mult = table[idx] ?? 0;
  return { index: idx, multiplier: mult, path };
}

// --- utils ---
const sum = (...xs: number[]) => xs.reduce((a,b)=>a+b,0);

// ---------- PLACE ----------
router.post("/place-bet", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { bet, params, currency, seeds } = (req.body || {}) as {
      bet?: number;
      params?: { rows?: number; risk?: Risk };
      currency?: "BTC"|"SOL"|string;
      seeds?: { clientSeed?: string };
    };

    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (currency !== "BTC" && currency !== "SOL") return res.status(400).json({ message: "Invalid currency" });

    const b = typeof bet === "number" && isFinite(bet) && bet >= 0 ? +bet : 0;
    const rows = [8,10,12,14,16].includes(params?.rows ?? 12) ? (params?.rows ?? 12) : 12;
    const risk: Risk = (["low","medium","high"] as const).includes((params?.risk as any)) ? (params!.risk as Risk) : "medium";

    let clientSeed = (seeds?.clientSeed || "").trim();
    if (!clientSeed) clientSeed = crypto.randomBytes(16).toString("hex");
    const serverSeed = crypto.randomBytes(32).toString("hex");
    const serverSeedHash = hashServerSeed(serverSeed);

    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const created = await prisma.$transaction(async (tx) => {
          if (b > 0) {
            const w = currency === "BTC" ? "btcWallet" : "solWallet";
            const updated = await (tx as any)[w].updateMany({
              where: { userId, balance: { gte: b } },
              data: { balance: { decrement: b } },
            });
            if (updated.count === 0) throw new Error("INSUFFICIENT_FUNDS");
          }

          const last = await tx.plinkoRound.findFirst({
            where: { userId, clientSeed },
            orderBy: { nonce: "desc" },
            select: { nonce: true },
          });
          const nonce = (last?.nonce ?? 0) + 1;

          return tx.plinkoRound.create({
            data: {
              userId,
              bet: b,
              currency,
              clientSeed,
              nonce,
              serverSeed,
              serverSeedHash,
              params: { rows, risk } as Prisma.InputJsonValue,
              state: { placed: true } as Prisma.InputJsonValue,
            },
            select: { id: true, clientSeed: true, nonce: true, serverSeedHash: true },
          });
        });

        return res.json({
          roundId: created.id,
          clientSeed: created.clientSeed,
          nonce: created.nonce,
          serverSeedHash: created.serverSeedHash
        });
      } catch (err: any) {
        if (err.message === "INSUFFICIENT_FUNDS") return res.status(400).json({ message: "Insufficient balance" });
        if (err.code === "P2002" && attempt < MAX_RETRIES) continue;
        console.error("plinko/place error:", err);
        return res.status(500).json({ message: "Internal server error" });
      }
    }
  } catch (e) {
    console.error("plinko/place outer:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ---------- RESOLVE ----------
router.post("/resolve", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { roundId, credit } = (req.body || {}) as { roundId?: string; credit?: boolean };
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!roundId) return res.status(400).json({ message: "Missing roundId" });

    const round = await prisma.plinkoRound.findUnique({ where: { id: roundId } });
    if (!round) return res.status(404).json({ message: "Round not found" });
    if (round.userId !== userId) return res.status(403).json({ message: "Forbidden" });

    const st = (round.state as any) || {};
    // idempotentno: če je že resolve-n, samo vrni zapisane podatke
    if (st.resolved) {
      return res.json({
        serverSeed: round.serverSeed,
        payout: Number(st.payout ?? 0),
        index: st.index,
        path: st.path,
        rows: st.rows,
        risk: st.risk,
        multiplier: st.multiplier,
        credited: !!st.credited,
      });
    }

    const p = (round.params as any) || {};
    const rows = p.rows ?? 12;
    const risk: Risk = (p.risk ?? "medium");

    const rng = hmacStream(round.serverSeed!, round.clientSeed, round.nonce);
    const drop = plinkoDrop(rows, risk, rng);

    const multiplier = drop.multiplier;
    // payout includes stake; FE already reserved -bet on place-bet
    const payout = round.bet > 0 ? +(round.bet * multiplier).toFixed(8) : 0;

    const doCredit = credit !== false; // default: true

    if (doCredit && payout > 0) {
      await prisma.$transaction(async (tx) => {
        const w = round.currency === "BTC" ? "btcWallet" : "solWallet";
        await (tx as any)[w].update({
          where: { userId: round.userId! },
          data: { balance: { increment: payout } },
        });
      });
    }

    await prisma.plinkoRound.update({
      where: { id: round.id },
      data: {
        state: {
          resolved: true,
          credited: doCredit,
          payout,
          index: drop.index,
          path: drop.path,
          rows,
          risk,
          multiplier,
        } as Prisma.InputJsonValue,
      },
    });

    return res.json({
      serverSeed: round.serverSeed,
      payout,
      index: drop.index,
      path: drop.path,
      rows,
      risk,
      multiplier,
      credited: doCredit,
    });
  } catch (e) {
    console.error("plinko/resolve:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ---------- SETTLE (kreditiraj po animaciji) ----------
router.post("/settle", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { roundId } = (req.body || {}) as { roundId?: string };
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!roundId) return res.status(400).json({ message: "Missing roundId" });

    const round = await prisma.plinkoRound.findUnique({ where: { id: roundId } });
    if (!round) return res.status(404).json({ message: "Round not found" });
    if (round.userId !== userId) return res.status(403).json({ message: "Forbidden" });

    const st = (round.state as any) || {};
    if (!st.resolved) return res.status(400).json({ message: "Round not resolved yet" });
    if (st.credited) {
      return res.json({ credited: 0, alreadyCredited: true });
    }

    const payout = Number(st.payout ?? 0);
    if (payout > 0) {
      await prisma.$transaction(async (tx) => {
        const w = round.currency === "BTC" ? "btcWallet" : "solWallet";
        await (tx as any)[w].update({
          where: { userId: round.userId! },
          data: { balance: { increment: payout } },
        });
      });
    }

    await prisma.plinkoRound.update({
      where: { id: round.id },
      data: { state: { ...st, credited: true } as Prisma.InputJsonValue },
    });

    return res.json({ credited: payout, alreadyCredited: false });
  } catch (e) {
    console.error("plinko/settle:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
