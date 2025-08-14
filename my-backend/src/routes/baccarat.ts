// routes/baccarat.ts
import express from "express";
import crypto from "crypto";
import { PrismaClient, Prisma } from "@prisma/client";
import { AuthRequest } from "../middleware/auth";

const router = express.Router();
const prisma = new PrismaClient();

const DECKS = 8;
const BANKER_COMMISSION = 0.05; // 5%
const TIE_PAYOUT = 8;

// --- Provably-fair (enako kot Dice/Mines) ---
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

// --- Cards / helpers ---
const RANK = (c: number) => c % 13;
const CARD_POINT = (r: number) => (r <= 7 ? r + 2 : r <= 11 ? 0 : 1);

function makeShoe(serverSeed: string, clientSeed: string, nonce: number) {
  const base = Array.from({ length: 52 }, (_, i) => i);
  const shoe = Array.from({ length: 52 * DECKS }, (_, i) => base[i % 52]);
  const rng = hmacStream(serverSeed, clientSeed, nonce);
  for (let i = shoe.length - 1; i > 0; i--) {
    const u = (rng.next().value as number) || Math.random();
    const j = Math.floor(u * (i + 1));
    [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
  }
  return shoe;
}

type Hand = number[];
const handPoints = (cards: Hand) => cards.reduce((s, c) => s + CARD_POINT(RANK(c)), 0) % 10;

const isNatural = (p: Hand, b: Hand) => {
  if (p.length < 2 || b.length < 2) return false;
  const pv = (CARD_POINT(RANK(p[0])) + CARD_POINT(RANK(p[1]))) % 10;
  const bv = (CARD_POINT(RANK(b[0])) + CARD_POINT(RANK(b[1]))) % 10;
  return pv >= 8 || bv >= 8;
};

function bankerShouldDraw(bankerTotal: number, playerThirdValue: number | null): boolean {
  if (playerThirdValue == null) return bankerTotal <= 5;
  switch (bankerTotal) {
    case 0:
    case 1:
    case 2:
      return true;
    case 3:
      return playerThirdValue !== 8;
    case 4:
      return playerThirdValue >= 2 && playerThirdValue <= 7;
    case 5:
      return playerThirdValue >= 4 && playerThirdValue <= 7;
    case 6:
      return playerThirdValue === 6 || playerThirdValue === 7;
    default:
      return false;
  }
}

function dealBaccarat(serverSeed: string, clientSeed: string, nonce: number) {
  const shoe = makeShoe(serverSeed, clientSeed, nonce);
  let ptr = 0;

  const player: Hand = [shoe[ptr++], shoe[ptr++]];
  const banker: Hand = [shoe[ptr++], shoe[ptr++]];

  if (!isNatural(player, banker)) {
    const pTotal = handPoints(player);
    let playerThirdValue: number | null = null;
    if (pTotal <= 5) {
      const pc3 = shoe[ptr++];
      player.push(pc3);
      playerThirdValue = CARD_POINT(RANK(pc3));
    }
    const bTotal = handPoints(banker);
    if (bankerShouldDraw(bTotal, playerThirdValue)) {
      banker.push(shoe[ptr++]);
    }
  }

  const pFinal = handPoints(player);
  const bFinal = handPoints(banker);
  const winner: "player" | "banker" | "tie" =
    pFinal > bFinal ? "player" : bFinal > pFinal ? "banker" : "tie";

  return { player, banker, pPoints: pFinal, bPoints: bFinal, winner, natural: isNatural(player, banker) };
}

// ---- API Types ----
type PlaceBody = {
  bets?: { player?: number; banker?: number; tie?: number };
  currency?: "BTC" | "SOL" | string;
  seeds?: { clientSeed?: string };
};
type RoundState = { status: "placed" | "resolved" };

const sumBets = (b?: PlaceBody["bets"]) =>
  Math.max(0, (b?.player ?? 0) + (b?.banker ?? 0) + (b?.tie ?? 0));

// ---------- PLACE ----------
router.post("/place-bet", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { bets, currency, seeds } = (req.body || {}) as PlaceBody;
    if (currency !== "BTC" && currency !== "SOL")
      return res.status(400).json({ message: "Invalid currency" });

    const s = (n?: number) => (typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : 0);
    const cleanBets = { player: s(bets?.player), banker: s(bets?.banker), tie: s(bets?.tie) };
    const totalBet = sumBets(cleanBets);

    let clientSeed = (seeds?.clientSeed || "").trim();
    if (!clientSeed) clientSeed = crypto.randomBytes(16).toString("hex");
    const serverSeed = crypto.randomBytes(32).toString("hex");
    const serverSeedHash = hashServerSeed(serverSeed);

    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const created = await prisma.$transaction(async (tx) => {
          if (totalBet > 0) {
            const w = currency === "BTC" ? "btcWallet" : "solWallet";
            const updated = await (tx as any)[w].updateMany({
              where: { userId, balance: { gte: totalBet } },
              data: { balance: { decrement: totalBet } },
            });
            if (updated.count === 0) throw new Error("INSUFFICIENT_FUNDS");
          }

          const last = await tx.baccaratRound.findFirst({
            where: { userId, clientSeed },
            orderBy: { nonce: "desc" },
            select: { nonce: true },
          });
          const nonce = (last?.nonce ?? 0) + 1;

          const state: RoundState = { status: "placed" };

          return tx.baccaratRound.create({
            data: {
              userId,
              currency,
              clientSeed,
              nonce,
              serverSeed,
              serverSeedHash,
              totalBet,
              betPlayer: cleanBets.player ?? 0,
              betBanker: cleanBets.banker ?? 0,
              betTie: cleanBets.tie ?? 0,
              state: state as unknown as Prisma.InputJsonValue,
            },
            select: { id: true, clientSeed: true, nonce: true, serverSeedHash: true },
          });
        });

        return res.json(created);
      } catch (err: any) {
        if (err.message === "INSUFFICIENT_FUNDS")
          return res.status(400).json({ message: "Insufficient balance" });
        if (err.code === "P2002" && attempt < MAX_RETRIES) continue;
        console.error("baccarat/place error:", err);
        return res.status(500).json({ message: "Internal server error" });
      }
    }
  } catch (e) {
    console.error("baccarat/place outer:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ---------- RESOLVE ----------
router.post("/resolve", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { roundId } = (req.body || {}) as { roundId?: string };
    if (!roundId) return res.status(400).json({ message: "Missing roundId" });

    const round = await prisma.baccaratRound.findUnique({ where: { id: roundId } });
    if (!round) return res.status(404).json({ message: "Round not found" });
    if (round.userId !== userId) return res.status(403).json({ message: "Forbidden" });

    const st = (round.state as unknown as RoundState) || { status: "placed" };
    if (st.status === "resolved")
      return res.status(400).json({ message: "Round already resolved" });

    const deal = dealBaccarat(round.serverSeed!, round.clientSeed, round.nonce);

    let payout = 0;
    const { betPlayer = 0, betBanker = 0, betTie = 0, currency } = round as any;

    if (deal.winner === "player") {
      payout += betPlayer * 2;
    } else if (deal.winner === "banker") {
      if (betBanker > 0) {
        const netProfit = betBanker * (1 - BANKER_COMMISSION);
        payout += betBanker + netProfit;
      }
    } else {
      payout += betTie * (1 + TIE_PAYOUT);
      payout += betPlayer; // push
      payout += betBanker; // push
    }

    if (payout > 0) {
      await prisma.$transaction(async (tx) => {
        const w = currency === "BTC" ? "btcWallet" : "solWallet";
        await (tx as any)[w].update({
          where: { userId: round.userId! },
          data: { balance: { increment: payout } },
        });
      });
    }

    await prisma.baccaratRound.update({
      where: { id: round.id },
      data: { state: { status: "resolved" } as any },
    });

    return res.json({
      serverSeed: round.serverSeed,
      player: deal.player,
      banker: deal.banker,
      pPoints: deal.pPoints,
      bPoints: deal.bPoints,
      winner: deal.winner,
      natural: deal.natural,
      payout,
    });
  } catch (e) {
    console.error("baccarat/resolve:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
