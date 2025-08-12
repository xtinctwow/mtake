import express from "express";
import crypto from "crypto";
import { PrismaClient, Prisma } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

function hashServerSeed(seed: string) {
  return crypto.createHash("sha256").update(seed).digest("hex");
}

// 🎲 POST /api/dice/place-bet
router.post("/place-bet", async (req, res) => {
  try {
    const { bet, mode, chance, currency, seeds } = req.body as {
      bet?: number;
      mode?: "over" | "under" | string;
      chance?: number;
      currency?: "BTC" | "SOL" | string;
      seeds?: { clientSeed?: string; nonce?: number };
    };

    const rawUserId = (req as any)?.user?.id;
    const userId =
      typeof rawUserId === "number"
        ? rawUserId
        : rawUserId
        ? Number(rawUserId)
        : null;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Basic validation
    if (typeof bet !== "number" || !Number.isFinite(bet) || bet <= 0) {
      return res.status(400).json({ message: "Invalid bet" });
    }
    if (mode !== "over" && mode !== "under") {
      return res.status(400).json({ message: "Invalid mode" });
    }
    if (
      typeof chance !== "number" ||
      !Number.isFinite(chance) ||
      chance <= 0 ||
      chance >= 100
    ) {
      return res.status(400).json({ message: "Invalid chance" });
    }
    if (currency !== "BTC" && currency !== "SOL") {
      return res.status(400).json({ message: "Invalid currency" });
    }

    // ClientSeed
    let clientSeed =
      (seeds?.clientSeed && String(seeds.clientSeed).trim()) || "";
    if (!clientSeed) {
      clientSeed = crypto.randomBytes(16).toString("hex");
    }

    const serverSeed = crypto.randomBytes(32).toString("hex");
    const serverSeedHash = hashServerSeed(serverSeed);

    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const created = await prisma.$transaction(async (tx) => {
          // Deduct balance from correct wallet
          if (currency === "BTC") {
            const updated = await tx.btcWallet.updateMany({
              where: { userId, balance: { gte: bet } },
              data: { balance: { decrement: bet } },
            });
            if (updated.count === 0) {
              throw new Error("INSUFFICIENT_FUNDS");
            }
          } else if (currency === "SOL") {
            const updated = await tx.solWallet.updateMany({
              where: { userId, balance: { gte: bet } },
              data: { balance: { decrement: bet } },
            });
            if (updated.count === 0) {
              throw new Error("INSUFFICIENT_FUNDS");
            }
          }

          // Find last nonce for (userId, clientSeed)
          const last = await tx.diceRound.findFirst({
            where: { userId, clientSeed },
            orderBy: { nonce: "desc" },
            select: { nonce: true },
          });
          const nextNonce = (last?.nonce ?? 0) + 1;

          // Create round
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
router.post("/resolve", async (req, res) => {
  try {
    const { roundId, outcome } = req.body as {
      roundId?: string;
      outcome?: number;
    };
    if (!roundId) {
      return res.status(400).json({ message: "Missing roundId" });
    }

    const round = await prisma.diceRound.findUnique({
      where: { id: roundId },
    });
    if (!round) {
      return res.status(404).json({ message: "Round not found" });
    }

    // Example: Determine win/loss (replace with your actual logic)
    let didWin = false;
    let payout = 0;
    if (typeof outcome === "number") {
      if (
        (round.mode === "over" && outcome > round.chance) ||
        (round.mode === "under" && outcome < round.chance)
      ) {
        didWin = true;
        payout = round.bet * (100 / round.chance); // example calc
      }
    }

    if (didWin && payout > 0) {
      await prisma.$transaction(async (tx) => {
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
      });
    }

    return res.json({
      serverSeed: round.serverSeed,
      didWin,
      payout,
    });
  } catch (err) {
    console.error("resolve error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
