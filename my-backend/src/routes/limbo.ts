// src/routes/limbo.ts
import express from "express";
import crypto from "crypto";
import { PrismaClient, Prisma } from "@prisma/client";
import { AuthRequest } from "../middleware/auth";

const router = express.Router();
const prisma = new PrismaClient();

const HOUSE_EDGE = 0.01;           // usklajeno s frontendom
const LIMBO_MIN_TARGET = 1.01;
const LIMBO_MAX_TARGET = 1_000_000;

// --- helpers ---
function hashServerSeed(seed: string) {
  return crypto.createHash("sha256").update(seed).digest("hex");
}
function hexToFloat01(hex: string): number {
  const slice = hex.slice(0, 13);
  const int = parseInt(slice, 16);
  const max = Math.pow(16, slice.length);
  return int / max; // (0,1)
}

/**
 * Deterministični limbo multiplikator s heavy-tail porazdelitvijo.
 * PRNG: HMAC-SHA256(serverSeed, `${serverSeed}:${clientSeed}:${nonce}:0`)
 * Formula: M = (1 - HE) / U, omejeno na [1.01, 1_000_000], zaokroženo navzdol na 2 dec.
 */
function resultMultiplierFromSeed(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  houseEdge: number
): number {
  const msg = `${serverSeed}:${clientSeed}:${nonce}:0`;
  const h = crypto
    .createHmac("sha256", Buffer.from(serverSeed, "utf8"))
    .update(Buffer.from(msg, "utf8"))
    .digest("hex");

  let u = hexToFloat01(h);          // (0,1)
  if (u <= 0) u = 1e-12;            // zaščita (skoraj nikoli)
  const raw = (1 - houseEdge) / u;  // heavy-tail
  let m = Math.floor(raw * 100) / 100; // 2 decimalni mesti, navzdol
  if (!Number.isFinite(m) || m < LIMBO_MIN_TARGET) m = LIMBO_MIN_TARGET;
  if (m > LIMBO_MAX_TARGET) m = LIMBO_MAX_TARGET;
  return m;
}

// 🎯 POST /api/limbo/place-bet
router.post("/place-bet", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { bet, target, currency, seeds } = req.body as {
      bet?: number;
      target?: number;
      currency?: "BTC" | "SOL" | string;
      seeds?: { clientSeed?: string };
    };

    // validacija
    if (
      typeof target !== "number" ||
      !Number.isFinite(target) ||
      target < LIMBO_MIN_TARGET ||
      target > LIMBO_MAX_TARGET
    ) {
      return res.status(400).json({ message: "Invalid target" });
    }
    if (typeof bet !== "number" || !Number.isFinite(bet) || bet < 0) {
      return res.status(400).json({ message: "Invalid bet" });
    }
    if (currency !== "BTC" && currency !== "SOL") {
      return res.status(400).json({ message: "Invalid currency" });
    }

    // client seed (če ni, generiramo)
    let clientSeed = (seeds?.clientSeed || "").trim();
    if (!clientSeed) clientSeed = crypto.randomBytes(16).toString("hex");

    // server commitment
    const serverSeed = crypto.randomBytes(32).toString("hex");
    const serverSeedHash = hashServerSeed(serverSeed);

    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const created = await prisma.$transaction(async (tx) => {
          // 1) rezervacija sredstva (samo če bet > 0)
          if (bet > 0) {
            if (currency === "BTC") {
              const up = await tx.btcWallet.updateMany({
                where: { userId, balance: { gte: bet } },
                data: { balance: { decrement: bet } },
              });
              if (up.count === 0) throw new Error("INSUFFICIENT_FUNDS");
            } else {
              const up = await tx.solWallet.updateMany({
                where: { userId, balance: { gte: bet } },
                data: { balance: { decrement: bet } },
              });
              if (up.count === 0) throw new Error("INSUFFICIENT_FUNDS");
            }
          }

          // 2) nonce++
          const last = await tx.limboRound.findFirst({
            where: { userId, clientSeed },
            orderBy: { nonce: "desc" },
            select: { nonce: true },
          });
          const nextNonce = (last?.nonce ?? 0) + 1;

          // 3) create runda
          return tx.limboRound.create({
            data: {
              userId,
              bet,
              target,
              clientSeed,
              nonce: nextNonce,
              serverSeed,
              serverSeedHash,
              currency,
            },
            select: {
              id: true,
              clientSeed: true,
              nonce: true,
              serverSeedHash: true,
            },
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
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002" &&
          attempt < MAX_RETRIES
        ) {
          // ponovi (kolizija na @@unique [userId, clientSeed, nonce])
          continue;
        }
        console.error("limbo/place-bet error:", err);
        return res.status(500).json({ message: "Internal server error" });
      }
    }
  } catch (e) {
    console.error("limbo/place-bet outer:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ✅ POST /api/limbo/resolve
router.post("/resolve", async (req: AuthRequest, res) => {
  try {
    const { roundId } = req.body as { roundId?: string };
    if (!roundId) return res.status(400).json({ message: "Missing roundId" });

    const round = await prisma.limboRound.findUnique({ where: { id: roundId } });
    if (!round) return res.status(404).json({ message: "Round not found" });

    // izračun determinističnega rezultata
    const resultMultiplier = resultMultiplierFromSeed(
      round.serverSeed,
      round.clientSeed,
      round.nonce,
      HOUSE_EDGE
    );

    const didWin = resultMultiplier >= round.target;
    const payout = didWin && round.bet > 0 ? round.bet * round.target : 0;

    // opcijsko: zapiši rezultat v DB (če imaš polje resultMult: Float?)
    try {
      await prisma.limboRound.update({
        where: { id: roundId },
        data: { resultMult: resultMultiplier }, // odstrani, če nimaš stolpca
      });
    } catch {
      // ignore if column doesn't exist
    }

    // win → nakaži v denarnico
    if (payout > 0) {
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
      resultMultiplier,
      didWin,
      payout,
    });
  } catch (e) {
    console.error("limbo/resolve error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
