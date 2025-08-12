import express from "express";
import crypto from "crypto";
import { PrismaClient, Prisma } from "@prisma/client";
import { AuthRequest } from "../middleware/auth";

const router = express.Router();
const prisma = new PrismaClient();

const HOUSE_EDGE = 0.01;

// ---- Helpers (PRNG + fair multiplier) ----
function hashServerSeed(seed: string) {
  return crypto.createHash("sha256").update(seed).digest("hex");
}

function hexToFloat01(hex: string): number {
  const slice = hex.slice(0, 13);
  const int = parseInt(slice, 16);
  const max = Math.pow(16, slice.length);
  return int / max; // [0,1)
}

function* seededFloats(serverSeed: string, clientSeed: string, nonce: number) {
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

function mineSetFromSeeds(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  mines: number
): Set<number> {
  const arr = Array.from({ length: 25 }, (_, i) => i);
  const rnd = seededFloats(serverSeed, clientSeed, nonce);
  // Fisher–Yates
  for (let i = arr.length - 1; i > 0; i--) {
    const r = (rnd.next().value as number) ?? 0;
    const j = Math.floor(r * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return new Set(arr.slice(0, mines));
}

function comb(n: number, k: number) {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - (k - i))) / i;
  return r;
}

function fairMultiplier(tiles: number, mines: number, safeRevealed: number, houseEdge = HOUSE_EDGE) {
  if (safeRevealed <= 0) return 1;
  const numerator = comb(tiles, safeRevealed);
  const denominator = comb(tiles - mines, safeRevealed);
  const raw = numerator / denominator;
  return raw * (1 - houseEdge);
}

// ---- POST /api/mines/place-bet ----
router.post("/place-bet", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { bet, mines, currency, seeds } = req.body as {
      bet?: number;
      mines?: number;
      currency?: "BTC" | "SOL" | string;
      seeds?: { clientSeed?: string };
    };

    if (!Number.isFinite(bet!) || bet! < 0) return res.status(400).json({ message: "Invalid bet" });
    if (!Number.isInteger(mines) || mines! < 1 || mines! > 24) return res.status(400).json({ message: "Invalid mines" });
    if (currency !== "BTC" && currency !== "SOL") return res.status(400).json({ message: "Invalid currency" });

    let clientSeed = (seeds?.clientSeed ?? "").trim();
    if (!clientSeed) clientSeed = crypto.randomBytes(16).toString("hex");

    const serverSeed = crypto.randomBytes(32).toString("hex");
    const serverSeedHash = hashServerSeed(serverSeed);

    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const created = await prisma.$transaction(async (tx) => {
          // rezervacija stake-a, če > 0
          if (bet! > 0) {
            if (currency === "BTC") {
              const upd = await tx.btcWallet.updateMany({
                where: { userId, balance: { gte: bet! } },
                data: { balance: { decrement: bet! } },
              });
              if (upd.count === 0) throw new Error("INSUFFICIENT_FUNDS");
            } else {
              const upd = await tx.solWallet.updateMany({
                where: { userId, balance: { gte: bet! } },
                data: { balance: { decrement: bet! } },
              });
              if (upd.count === 0) throw new Error("INSUFFICIENT_FUNDS");
            }
          }

          // server-managed nonce
          const last = await tx.minesRound.findFirst({
            where: { userId, clientSeed },
            orderBy: { nonce: "desc" },
            select: { nonce: true },
          });
          const nextNonce = (last?.nonce ?? 0) + 1;

          return tx.minesRound.create({
            data: {
              userId,
              bet: bet!,
              currency,
              mines: mines!,
              clientSeed,
              nonce: nextNonce,
              serverSeed,
              serverSeedHash,
              status: "live",
              revealed: [],
              safeRevealed: 0,
            },
            select: { id: true, clientSeed: true, nonce: true, serverSeedHash: true },
          });
        });

        return res.json({
          roundId: created.id,
          clientSeed: created.clientSeed,
          nonce: created.nonce,
          serverSeedHash: created.serverSeedHash,
        });
      } catch (err: any) {
        if (err.message === "INSUFFICIENT_FUNDS") {
          return res.status(400).json({ message: "Insufficient balance" });
        }
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002" && attempt < MAX_RETRIES) {
          continue; // retry nonce collision
        }
        console.error("mines place-bet error:", err);
        return res.status(500).json({ message: "Internal server error" });
      }
    }
  } catch (err) {
    console.error("mines place-bet outer:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ---- POST /api/mines/reveal ----
router.post("/reveal", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { roundId, index } = req.body as { roundId?: string; index?: number };
    if (!roundId || !Number.isInteger(index) || index! < 0 || index! > 24) {
      return res.status(400).json({ message: "Invalid payload" });
    }

    const round = await prisma.minesRound.findUnique({ where: { id: roundId } });
    if (!round || round.userId !== userId) return res.status(404).json({ message: "Round not found" });
    if (round.status !== "live") return res.status(400).json({ message: "Round not live" });
    if (round.revealed.includes(index!)) {
      return res.json({ hitMine: false, safeRevealed: round.safeRevealed, status: "live" as const });
    }

    const mines = mineSetFromSeeds(round.serverSeed, round.clientSeed, round.nonce, round.mines);
    const isMine = mines.has(index!);

    if (isMine) {
      // bust – zaključimo rundo in razkrijemo serverSeed + layout
      const layout = Array.from({ length: 25 }, (_, i) => (mines.has(i) ? 1 : 0));
      await prisma.minesRound.update({
        where: { id: roundId },
        data: {
          status: "bust",
          revealed: { set: Array.from(new Set([...round.revealed, index!])) },
        },
      });
      return res.json({
        hitMine: true,
        status: "bust" as const,
        safeRevealed: round.safeRevealed,
        serverSeed: round.serverSeed,
        layout,
      });
    }

    // safe – zabeležimo klik
    const updated = await prisma.minesRound.update({
      where: { id: roundId },
      data: {
        revealed: { set: Array.from(new Set([...round.revealed, index!])) },
        safeRevealed: { increment: 1 },
      },
      select: { safeRevealed: true },
    });

    return res.json({ hitMine: false, safeRevealed: updated.safeRevealed, status: "live" as const });
  } catch (err) {
    console.error("mines reveal error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ---- POST /api/mines/cashout ----
router.post("/cashout", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { roundId } = req.body as { roundId?: string };
    if (!roundId) return res.status(400).json({ message: "Missing roundId" });

    const round = await prisma.minesRound.findUnique({ where: { id: roundId } });
    if (!round || round.userId !== userId) return res.status(404).json({ message: "Round not found" });
    if (round.status !== "live") return res.status(400).json({ message: "Round not live" });
    if (round.safeRevealed <= 0) return res.status(400).json({ message: "Nothing to cash out" });

    const mult = fairMultiplier(25, round.mines, round.safeRevealed, HOUSE_EDGE);
    const payout = round.bet * mult; // stake + profit (kot pri Dice)

    await prisma.$transaction(async (tx) => {
      // nakaži payout (če je bet 0, bo tudi payout 0)
      if (payout > 0) {
        if (round.currency === "BTC") {
          await tx.btcWallet.update({
            where: { userId: round.userId! },
            data: { balance: { increment: payout } },
          });
        } else if (round.currency === "SOL") {
          await tx.solWallet.update({
            where: { userId: round.userId! },
            data: { balance: { increment: payout } },
          });
        }
      }
      await tx.minesRound.update({
        where: { id: roundId },
        data: { status: "cashed" },
      });
    });

    const mines = mineSetFromSeeds(round.serverSeed, round.clientSeed, round.nonce, round.mines);
    const layout = Array.from({ length: 25 }, (_, i) => (mines.has(i) ? 1 : 0));

    return res.json({
      serverSeed: round.serverSeed,
      payout,
      layout,
    });
  } catch (err) {
    console.error("mines cashout error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
