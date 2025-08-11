import express from "express";
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

// Helper za hashiranje serverSeed
function hashServerSeed(seed: string) {
  return crypto.createHash("sha256").update(seed).digest("hex");
}

// 🎲 POST /api/dice/place-bet
router.post("/place-bet", async (req, res) => {
  const { bet, mode, chance, seeds } = req.body;
  const userId = req.user?.id || null; // Če uporabljaš auth middleware

  if (!bet || !mode || !chance) {
    return res.status(400).json({ message: "Missing bet parameters" });
  }

  // Če uporabnik še nima clientSeed/serverSeed v bazi, ustvarimo
  let clientSeed = seeds?.clientSeed;
  let nonce = seeds?.nonce || 1;

  if (!clientSeed) {
    clientSeed = crypto.randomBytes(16).toString("hex");
  }

  // Generiramo random serverSeed
  const serverSeed = crypto.randomBytes(32).toString("hex");
  const serverSeedHash = hashServerSeed(serverSeed);

  // Shraniš v bazo, če želiš imeti replay/provably fair
  await prisma.diceRound.create({
    data: {
      userId,
      bet,
      mode,
      chance,
      clientSeed,
      nonce,
      serverSeed,
      serverSeedHash
    }
  });

  return res.json({
    roundId: Date.now().toString(), // ali ID iz baze
    clientSeed,
    nonce,
    serverSeedHash
  });
});

// 🎲 POST /api/dice/resolve
router.post("/resolve", async (req, res) => {
  const { roundId } = req.body;

  const round = await prisma.diceRound.findUnique({
    where: { id: roundId }
  });

  if (!round) {
    return res.status(404).json({ message: "Round not found" });
  }

  return res.json({
    serverSeed: round.serverSeed
  });
});

export default router;
