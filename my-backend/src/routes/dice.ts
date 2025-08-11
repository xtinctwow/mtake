import express from "express";
import crypto from "crypto";
import { PrismaClient, Prisma } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

// Hash helper for serverSeed (commitment)
function hashServerSeed(seed: string) {
  return crypto.createHash("sha256").update(seed).digest("hex");
}

// 🎲 POST /api/dice/place-bet
router.post("/place-bet", async (req, res) => {
  try {
    const { bet, mode, chance, seeds } = req.body as {
      bet?: number;
      mode?: "over" | "under" | string;
      chance?: number;
      seeds?: { clientSeed?: string; nonce?: number };
    };

    // Coerce userId to Int? (nullable) for Prisma
    const rawUserId = (req as any)?.user?.id;
    const userId =
      typeof rawUserId === "number"
        ? rawUserId
        : rawUserId
        ? Number(rawUserId)
        : null;

    // --- Basic validation ---
    if (typeof bet !== "number" || !Number.isFinite(bet) || bet < 0) {
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

    // --- ClientSeed: use provided or generate one ---
    let clientSeed =
      (seeds?.clientSeed && String(seeds.clientSeed).trim()) || "";
    if (!clientSeed) {
      clientSeed = crypto.randomBytes(16).toString("hex");
    }

    // --- Server seed: keep secret, return only the hash now ---
    const serverSeed = crypto.randomBytes(32).toString("hex");
    const serverSeedHash = hashServerSeed(serverSeed);

    // --- Create the round with a server-managed nonce ---
    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const created = await prisma.$transaction(async (tx) => {
          // Find last nonce for (userId, clientSeed)
          const last = await tx.diceRound.findFirst({
            where: { userId, clientSeed },
            orderBy: { nonce: "desc" },
            select: { nonce: true },
          });

          const nextNonce = (last?.nonce ?? 0) + 1;

          // Persist new round with the next nonce
          return tx.diceRound.create({
            data: {
              userId,
              bet,
              mode,
              chance,
              clientSeed,
              nonce: nextNonce, // <-- server-chosen
              serverSeed,
              serverSeedHash,
            },
            select: {
              id: true,
              clientSeed: true,
              nonce: true,
              serverSeedHash: true,
            },
          });
        });

        // Success
        return res.json({
          roundId: created.id,
          clientSeed: created.clientSeed,
          nonce: created.nonce,
          serverSeedHash: created.serverSeedHash,
        });
      } catch (err: any) {
        // Handle rare race condition if @@unique constraint is hit
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002" &&
          attempt < MAX_RETRIES
        ) {
          continue; // retry
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
    const { roundId } = req.body as { roundId?: string };
    if (!roundId) {
      return res.status(400).json({ message: "Missing roundId" });
    }

    const round = await prisma.diceRound.findUnique({
      where: { id: roundId },
    });

    if (!round) {
      return res.status(404).json({ message: "Round not found" });
    }

    return res.json({ serverSeed: round.serverSeed });
  } catch (err) {
    console.error("resolve error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
