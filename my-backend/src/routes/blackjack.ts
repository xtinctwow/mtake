import express from "express";
import crypto from "crypto";
import { PrismaClient, Prisma } from "@prisma/client";
import { AuthRequest } from "../middleware/auth";

const router = express.Router();
const prisma = new PrismaClient();

// --- rules ---
const HOUSE_EDGE = 0.0057;                // ~0.57%
const DECKS = 6;                           // 6-deck shoe
const BJ_PAYOUT = 1.5;                     // 3:2
const DEALER_STANDS_SOFT_17 = true;        // S17

// ---- helpers (provably-fair RNG) ----
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

// card encoding: 0..51 (rank 0..12 = 2..A, suit 0..3)
const RANK = (c: number) => c % 13;          // 0..12
const VALUE = (r: number) => (r >= 0 && r <= 8 ? r + 2 : r <= 11 ? 10 : 11); // 2..10, JQK=10, A=11

function makeShoe(serverSeed: string, clientSeed: string, nonce: number) {
  const baseDeck = Array.from({ length: 52 }, (_, i) => i);
  const shoe = Array.from({ length: 52 * DECKS }, (_, i) => baseDeck[i % 52]);
  // Fisher-Yates z našim PRNG
  const rng = hmacStream(serverSeed, clientSeed, nonce);
  for (let i = shoe.length - 1; i > 0; i--) {
    const u = (rng.next().value as number) || Math.random();
    const j = Math.floor(u * (i + 1));
    [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
  }
  return shoe;
}

type BJState = {
  deck: number[];
  drawPtr: number;
  hands: { cards: number[]; bet: number; stood: boolean; doubled?: boolean; splitFrom?: boolean }[];
  dealer: number[]; // [up, hole, ...]
  active: number;   // index handa na potezi
  status: "playing" | "settled";
};

function draw(state: BJState) {
  const c = state.deck[state.drawPtr++];
  if (c === undefined) throw new Error("Shoe empty");
  return c;
}

function handValue(cards: number[]) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    const r = RANK(c);
    total += VALUE(r);
    if (r === 12) aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}
const isBlackjack = (cards: number[]) => cards.length === 2 && handValue(cards) === 21;
const isPair = (cards: number[]) => cards.length === 2 && RANK(cards[0]) === RANK(cards[1]);

function dealerPlay(state: BJState) {
  // draw to 17 (S17/H17)
  while (true) {
    const v = handValue(state.dealer);
    if (v > 21) break;
    if (v > 17) break;
    if (v === 17 && DEALER_STANDS_SOFT_17) break;
    state.dealer.push(draw(state));
  }
}

// ---------- PLACE BET ----------
router.post("/place-bet", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { bet, currency, seeds } = req.body as {
      bet?: number;
      currency?: "BTC" | "SOL" | string;
      seeds?: { clientSeed?: string };
    };

    if (typeof bet !== "number" || !Number.isFinite(bet) || bet < 0)
      return res.status(400).json({ message: "Invalid bet" });
    if (currency !== "BTC" && currency !== "SOL")
      return res.status(400).json({ message: "Invalid currency" });

    let clientSeed = (seeds?.clientSeed || "").trim();
    if (!clientSeed) clientSeed = crypto.randomBytes(16).toString("hex");

    const serverSeed = crypto.randomBytes(32).toString("hex");
    const serverSeedHash = hashServerSeed(serverSeed);

    // txn: reserve stake (če bet > 0), določi nonce in ustvari začetno stanje
    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const created = await prisma.$transaction(async (tx) => {
          if (bet > 0) {
            const w = currency === "BTC" ? "btcWallet" : "solWallet";
            const updated = await (tx as any)[w].updateMany({
              where: { userId, balance: { gte: bet } },
              data: { balance: { decrement: bet } },
            });
            if (updated.count === 0) throw new Error("INSUFFICIENT_FUNDS");
          }

          const last = await tx.blackjackRound.findFirst({
            where: { userId, clientSeed },
            orderBy: { nonce: "desc" },
            select: { nonce: true },
          });
          const nonce = (last?.nonce ?? 0) + 1;

          // inicializiraj shoe in razdeli začetne karte
          const deck = makeShoe(serverSeed, clientSeed, nonce);
          const st: BJState = {
            deck,
            drawPtr: 0,
            hands: [{ cards: [deck[0], deck[2]], bet, stood: false }],
            dealer: [deck[1], deck[3]],
            active: 0,
            status: "playing",
          };
          st.drawPtr = 4;

          return tx.blackjackRound.create({
            data: {
              userId, bet, currency,
              clientSeed, nonce, serverSeed, serverSeedHash,
              state: st as unknown as Prisma.InputJsonValue,
            },
            select: {
              id: true, clientSeed: true, nonce: true, serverSeedHash: true, state: true,
            },
          });
        });

        const st = created.state as unknown as BJState;
        return res.json({
          roundId: created.id,
          clientSeed: created.clientSeed,
          nonce: created.nonce,
          serverSeedHash: created.serverSeedHash,
          player: st.hands[0].cards,
          dealerUp: st.dealer[0],
          canSplit: isPair(st.hands[0].cards),
          canDouble: true,
          blackjack: isBlackjack(st.hands[0].cards),
        });
      } catch (err: any) {
        if (err.message === "INSUFFICIENT_FUNDS")
          return res.status(400).json({ message: "Insufficient balance" });
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002" && attempt < MAX_RETRIES)
          continue;
        console.error("bj/place error:", err);
        return res.status(500).json({ message: "Internal server error" });
      }
    }
  } catch (e) {
    console.error("bj/place outer:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ---------- ACTIONS ----------
router.post("/hit", async (req: AuthRequest, res) => {
  const { roundId, handIndex = 0 } = req.body as { roundId?: string; handIndex?: number };
  if (!roundId) return res.status(400).json({ message: "Missing roundId" });

  const round = await prisma.blackjackRound.findUnique({ where: { id: roundId } });
  if (!round) return res.status(404).json({ message: "Round not found" });

  const st = round.state as unknown as BJState;
  if (st.status !== "playing") return res.status(400).json({ message: "Round settled" });

  const h = st.hands[handIndex];
  if (!h || h.stood) return res.status(400).json({ message: "Invalid hand" });

  h.cards.push(draw(st));
  const v = handValue(h.cards);
  const drawn = h.cards[h.cards.length - 1];
  const bust = v > 21;

  // če bust → naslednja roka ali dealer
  if (bust) {
    h.stood = true;
    // move to next active
    const next = st.hands.findIndex((x, i) => !x.stood && i !== handIndex);
    if (next === -1) {
      // dealer resolve
      dealerPlay(st);
      st.status = "settled";
    } else {
      st.active = next;
    }
  }

  await prisma.blackjackRound.update({ where: { id: roundId }, data: { state: st as any } });

  // če smo zaključili, vrni settle (z zadnjo karto ob bustu)
  if (st.status === "settled") {
    const settle = await settleRound(prisma, round, st, drawn);
    return res.json(settle);
  }

  return res.json({ card: drawn, value: v, bust });
});

router.post("/stand", async (req: AuthRequest, res) => {
  const { roundId } = req.body as { roundId?: string };
  if (!roundId) return res.status(400).json({ message: "Missing roundId" });

  const round = await prisma.blackjackRound.findUnique({ where: { id: roundId } });
  if (!round) return res.status(404).json({ message: "Round not found" });

  const st = round.state as unknown as BJState;
  if (st.status !== "playing") return res.status(400).json({ message: "Round settled" });

  // označi aktivno kot stood; če ni več ne-stood → dealer
  st.hands[st.active].stood = true;
  const next = st.hands.findIndex((h) => !h.stood);
  if (next === -1) {
    dealerPlay(st);
    st.status = "settled";
  } else {
    st.active = next;
  }
  await prisma.blackjackRound.update({ where: { id: roundId }, data: { state: st as any } });

  if (st.status === "settled") {
    const settle = await settleRound(prisma, round, st);
    return res.json(settle);
  }
  return res.json({ ok: true, active: st.active });
});

router.post("/double", async (req: AuthRequest, res) => {
  const { roundId } = req.body as { roundId?: string };
  if (!roundId) return res.status(400).json({ message: "Missing roundId" });

  const round = await prisma.blackjackRound.findUnique({ where: { id: roundId } });
  if (!round) return res.status(404).json({ message: "Round not found" });

  const st = round.state as unknown as BJState;
  const h = st.hands[st.active];
  if (!h || h.cards.length !== 2) return res.status(400).json({ message: "Cannot double now" });

  // zaračunaj dodatni stake
  const ok = await prisma.$transaction(async (tx) => {
    const w = round.currency === "BTC" ? "btcWallet" : "solWallet";
    const up = await (tx as any)[w].updateMany({
      where: { userId: round.userId!, balance: { gte: round.bet } },
      data: { balance: { decrement: round.bet } },
    });
    return up.count > 0;
  }).catch(() => false);

  if (!ok) return res.status(400).json({ message: "Insufficient balance" });

  h.bet += round.bet;
  h.doubled = true;
  h.cards.push(draw(st));
  const drawn = h.cards[h.cards.length - 1];
  h.stood = true;

  // če so vse roke stood → dealer
  if (st.hands.every((x) => x.stood)) {
    dealerPlay(st);
    st.status = "settled";
  }
  await prisma.blackjackRound.update({ where: { id: roundId }, data: { state: st as any } });

  if (st.status === "settled") {
    const settle = await settleRound(prisma, round, st, drawn); // <-- vrni tudi playerCard
    return res.json(settle);
  }
  return res.json({ card: drawn, value: handValue(h.cards) });
});

router.post("/split", async (req: AuthRequest, res) => {
  const { roundId } = req.body as { roundId?: string };
  if (!roundId) return res.status(400).json({ message: "Missing roundId" });

  const round = await prisma.blackjackRound.findUnique({ where: { id: roundId } });
  if (!round) return res.status(404).json({ message: "Round not found" });

  const st = round.state as unknown as BJState;
  const h = st.hands[st.active];
  if (!h || !isPair(h.cards) || st.hands.length >= 2) {
    return res.status(400).json({ message: "Cannot split" });
  }

  // zaračunaj drugi stake
  const ok = await prisma.$transaction(async (tx) => {
    const w = round.currency === "BTC" ? "btcWallet" : "solWallet";
    const up = await (tx as any)[w].updateMany({
      where: { userId: round.userId!, balance: { gte: round.bet } },
      data: { balance: { decrement: round.bet } },
    });
    return up.count > 0;
  }).catch(() => false);

  if (!ok) return res.status(400).json({ message: "Insufficient balance" });

  const second = h.cards.pop()!;
  const h1 = { cards: [h.cards[0], draw(st)], bet: round.bet, stood: false, splitFrom: true };
  const h2 = { cards: [second, draw(st)], bet: round.bet, stood: false, splitFrom: true };
  st.hands = [h1, h2];
  st.active = 0;

  await prisma.blackjackRound.update({ where: { id: roundId }, data: { state: st as any } });
  return res.json({ hands: st.hands.map(x => x.cards), canDouble: true });
});

// ---------- settle ----------
async function settleRound(
  prisma: PrismaClient,
  round: any,
  st: BJState,
  playerCard?: number, // <-- NOVO: zadnja karta (double ali hit-bust), če želimo, da jo UI vidi
) {
  const dealerV = handValue(st.dealer);
  let totalPayout = 0;
  const outcomes: Array<{ value: number; result: "win" | "lose" | "push" | "blackjack"; payout: number }> = [];

  for (const h of st.hands) {
    const v = handValue(h.cards);
    let payout = 0;
    let result: "win" | "lose" | "push" | "blackjack" = "lose";

    const bj = isBlackjack(h.cards);
    const dealerBJ = isBlackjack(st.dealer);

    if (bj && !h.splitFrom) {
      if (!dealerBJ) { payout = h.bet * (1 + BJ_PAYOUT); result = "blackjack"; }
      else { payout = h.bet; result = "push"; }
    } else if (v > 21) {
      payout = 0; result = "lose";
    } else if (dealerV > 21 || v > dealerV) {
      payout = h.bet * 2; result = "win";
    } else if (v < dealerV) {
      payout = 0; result = "lose";
    } else {
      payout = h.bet; result = "push";
    }

    totalPayout += payout;
    outcomes.push({ value: v, result, payout });
  }

  // nakaži payout
  if (totalPayout > 0) {
    await prisma.$transaction(async (tx) => {
      const w = round.currency === "BTC" ? "btcWallet" : "solWallet";
      await (tx as any)[w].update({
        where: { userId: round.userId! },
        data: { balance: { increment: totalPayout } },
      });
    });
  }

  // shrani dealerjeve karte in status
  await prisma.blackjackRound.update({
    where: { id: round.id },
    data: { state: { ...st, status: "settled" } as any },
  });

  return {
    serverSeed: round.serverSeed,
    dealer: st.dealer,
    outcomes,
    totalPayout,
    ...(typeof playerCard === "number" ? { playerCard } : {}), // <-- UI bo lahko narisal zadnjo karto
  };
}

export default router;
