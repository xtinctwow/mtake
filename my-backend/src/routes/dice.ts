// src/routes/dice.ts
import express from "express";
import crypto from "crypto";
import { PrismaClient, Prisma } from "@prisma/client";
import { AuthRequest } from "../middleware/auth";

const router = express.Router();
const prisma = new PrismaClient();

const HOUSE_EDGE = 0.01;

// --- Helpers ---
function hashServerSeed(seed: string) {
  return crypto.createHash("sha256").update(seed).digest("hex");
}

function hexToFloat01(hex: string): number {
  const slice = hex.slice(0, 13);
  const int = parseInt(slice, 16);
  const max = Math.pow(16, slice.length);
  return int / max; // [0,1)
}

// HMAC(serverSeed, `${serverSeed}:${clientSeed}:${nonce}:0`)
function rollFromSeeds(serverSeed: string, clientSeed: string, nonce: number): number {
  const msg = `${serverSeed}:${clientSeed}:${nonce}:0`;
  const h = crypto
    .createHmac("sha256", Buffer.from(serverSeed, "utf8"))
    .update(Buffer.from(msg, "utf8"))
    .digest("hex");
  const r01 = hexToFloat01(h);
  return Math.floor(r01 * 10000) / 100; // 0.00–99.99
}

function multiplierFromChance(chance: number, houseEdge: number) {
  return (100 / chance) * (1 - houseEdge);
}

// 🎲 POST /api/dice/place-bet
router.post("/place-bet", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { bet, mode, chance, currency, seeds } = req.body as {
      bet?: number;
      mode?: "over" | "under" | string;
      chance?: number;
      currency?: "BTC" | "SOL" | string;
      seeds?: { clientSeed?: string; nonce?: number };
    };

    // ✅ Dovoli 0; zavrni samo negativne ali NaN
    if (typeof bet !== "number" || !Number.isFinite(bet) || bet < 0) {
      return res.status(400).json({ message: "Invalid bet" });
    }
    if (mode !== "over" && mode !== "under") return res.status(400).json({ message: "Invalid mode" });
    if (typeof chance !== "number" || !Number.isFinite(chance) || chance <= 0 || chance >= 100) {
      return res.status(400).json({ message: "Invalid chance" });
    }
    if (currency !== "BTC" && currency !== "SOL") {
      return res.status(400).json({ message: "Invalid currency" });
    }

    let clientSeed = (seeds?.clientSeed && String(seeds.clientSeed).trim()) || "";
    if (!clientSeed) clientSeed = crypto.randomBytes(16).toString("hex");

    const serverSeed = crypto.randomBytes(32).toString("hex");
    const serverSeedHash = hashServerSeed(serverSeed);

    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const created = await prisma.$transaction(async (tx) => {
          // ✅ Odštevanje samo če je bet > 0 (free roll preskoči)
          if (bet > 0) {
            if (currency === "BTC") {
              const updated = await tx.btcWallet.updateMany({
                where: { userId, balance: { gte: bet } },
                data: { balance: { decrement: bet } },
              });
              if (updated.count === 0) throw new Error("INSUFFICIENT_FUNDS");
            } else {
              const updated = await tx.solWallet.updateMany({
                where: { userId, balance: { gte: bet } },
                data: { balance: { decrement: bet } },
              });
              if (updated.count === 0) throw new Error("INSUFFICIENT_FUNDS");
            }
          }

          const last = await tx.diceRound.findFirst({
            where: { userId, clientSeed },
            orderBy: { nonce: "desc" },
            select: { nonce: true },
          });
          const nextNonce = (last?.nonce ?? 0) + 1;

          return tx.diceRound.create({
            data: {
              userId,
              bet,
              mode,
              chance,
              clientSeed,
              nonce: nextNonce,
              serverSeed,
              serverSeedHash,
              currency,
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
          continue;
        }
        console.error("place-bet error:", err);
        return res.status(500).json({ message: "Internal server error" });
      }
    }
  } catch (err) {
    console.error("place-bet outer error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// 🎲 POST /api/dice/resolve
router.post("/resolve", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { roundId } = req.body as { roundId?: string };
    if (!roundId) {
      return res.status(400).json({ message: "Missing roundId" });
    }

    const round = await prisma.diceRound.findUnique({ where: { id: roundId } });
    if (!round) {
      return res.status(404).json({ message: "Round not found" });
    }
    if (round.userId !== userId) {
      // zaščita: drugi uporabnik ne more “resolve-at” tvoje runde
      return res.status(403).json({ message: "Forbidden" });
    }

    // Strežnik sam izračuna roll (ne zaupa klientu)
    const roll = rollFromSeeds(round.serverSeed, round.clientSeed, round.nonce);
    const didWin =
      (round.mode === "over" && roll > round.chance) ||
      (round.mode === "under" && roll < round.chance);

    let payout = 0;
    if (didWin) {
      const mult = multiplierFromChance(round.chance, HOUSE_EDGE);
      payout = round.bet * mult; // stake + profit
    }

    // ⚠️ TODO (priporočeno): dodaj polje `resolvedAt`/`paid` v DiceRound,
    // in plačaj samo 1x znotraj transakcije.
    if (didWin && payout > 0) {
      await prisma.$transaction(async (tx) => {
        if (round.currency === "BTC") {
          await tx.btcWallet.update({
            where: { userId: round.userId! },
            data: { balance: { increment: payout } },
          });
        } else {
          await tx.solWallet.update({
            where: { userId: round.userId! },
            data: { balance: { increment: payout } },
          });
        }
      });
    }

    return res.json({
      serverSeed: round.serverSeed,
      roll, // 0.00–99.99
      didWin,
      payout,
    });
  } catch (err) {
    console.error("resolve error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
