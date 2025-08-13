import express from "express";
import crypto from "crypto";
import { PrismaClient, Prisma } from "@prisma/client";
import { AuthRequest } from "../middleware/auth";

const router = express.Router();
const prisma = new PrismaClient();

// --- rules ---
const HOUSE_EDGE = 0.0057;                // ~0.57%
const DECKS = 6;                          // 6-deck shoe
const BJ_PAYOUT = 1.5;                    // 3:2
const DEALER_STANDS_SOFT_17 = true;       // S17

// allow split of “mixed tens” (10/J/Q/K in any combo)
const ALLOW_MIXED_TENS_SPLIT = true;

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
  // Fisher-Yates with our PRNG
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
  active: number;   // index of hand on turn
  status: "playing" | "settled";
  insuranceOffered?: boolean;   // true takoj po dealu, če je upcard Ace
  insuranceBet?: number;        // znesek insurance side-beta
};

function draw(state: BJState) {
  const c = state.deck[state.drawPtr++];
  if (c === undefined) throw new Error("Shoe empty");
  return c;
}

function clearInsurance(st: BJState) {
  if (st.insuranceOffered) st.insuranceOffered = false;
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
const isPairRank   = (cards: number[]) => cards.length === 2 && RANK(cards[0]) === RANK(cards[1]);
const isMixedTensPair = (cards: number[]) =>
  cards.length === 2 && VALUE(RANK(cards[0])) === 10 && VALUE(RANK(cards[1])) === 10;

function canSplitHand(cards: number[]) {
  if (cards.length !== 2) return false;
  if (isPairRank(cards)) return true;
  if (ALLOW_MIXED_TENS_SPLIT && isMixedTensPair(cards)) return true;
  return false;
}

function dealerPlay(state: BJState) {
  // draw to 17 (S17/H17)
  while (true) {
    const v = handValue(state.dealer);
    if (v > 21) break;
    if (v > 17) break;
    if (v === 17 && DEALER_STANDS_SOFT_17) break; // simple S17 (treats any 17 as stand)
    state.dealer.push(draw(state));
  }
}

// Is any player hand ≤ 21?
function anyPlayerAlive(st: BJState) {
  return st.hands.some(h => handValue(h.cards) <= 21);
}

// Next active hand or finish; dealer draws only if any hand is alive
function finishOrNext(st: BJState, skipIndex?: number) {
  const next = st.hands.findIndex((h, i) => !h.stood && i !== skipIndex);
  if (next !== -1) {
    st.active = next;
    return;
  }
  // no active hands left
  if (anyPlayerAlive(st)) {
    dealerPlay(st);
  }
  st.status = "settled";
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

    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const created = await prisma.$transaction(async (tx) => {
          // reserve stake
          if (bet > 0) {
            const w = currency === "BTC" ? "btcWallet" : "solWallet";
            const updated = await (tx as any)[w].updateMany({
              where: { userId, balance: { gte: bet } },
              data: { balance: { decrement: bet } },
            });
            if (updated.count === 0) throw new Error("INSUFFICIENT_FUNDS");
          }

          // compute nonce
          const last = await tx.blackjackRound.findFirst({
            where: { userId, clientSeed },
            orderBy: { nonce: "desc" },
            select: { nonce: true },
          });
          const nonce = (last?.nonce ?? 0) + 1;

          // build initial state
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

          // Insurance: offer if upcard is Ace
          const upIsAce = RANK(st.dealer[0]) === 12;
          st.insuranceOffered = upIsAce;
          st.insuranceBet = 0;

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
          canSplit: canSplitHand(st.hands[0].cards),
          canDouble: true,
          blackjack: isBlackjack(st.hands[0].cards),
          canInsurance: !!st.insuranceOffered,
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
  const { roundId } = req.body as { roundId?: string };
  if (!roundId) return res.status(400).json({ message: "Missing roundId" });

  const round = await prisma.blackjackRound.findUnique({ where: { id: roundId } });
  if (!round) return res.status(404).json({ message: "Round not found" });

  const st = round.state as unknown as BJState;
	// TS-safe check, izogne se TS2367 narrowing opozorilu
	if ((st.status as string) === "settled") {
	  return res.status(400).json({ message: "Round settled" });
	}

  // always act on the active hand
  const idx = st.active;
  const h = st.hands[idx];
  if (!h || h.stood) return res.status(400).json({ message: "Invalid hand" });

  clearInsurance(st);
  h.cards.push(draw(st));
  const drawn = h.cards[h.cards.length - 1];
  const v = handValue(h.cards);
  const bust = v > 21;

  if (bust) {
    h.stood = true;
    finishOrNext(st, idx);
  }

  await prisma.blackjackRound.update({ where: { id: roundId }, data: { state: st as any } });

  if (st.status === "settled") {
    const settle = await settleRound(prisma, round, st, drawn);
    return res.json(settle);
  }

  return res.json({ card: drawn, value: v, bust, active: st.active });
});

router.post("/stand", async (req: AuthRequest, res) => {
  const { roundId } = req.body as { roundId?: string };
  if (!roundId) return res.status(400).json({ message: "Missing roundId" });

  const round = await prisma.blackjackRound.findUnique({ where: { id: roundId } });
  if (!round) return res.status(404).json({ message: "Round not found" });

  const st = round.state as unknown as BJState;
  if ((st.status as string) === "settled") {
    return res.status(400).json({ message: "Round settled" });
  }
  
  clearInsurance(st);

  // označi aktivno roko kot stood in izberi naslednjo ali zaključek
  st.hands[st.active].stood = true;
  finishOrNext(st);

  // izračunaj settled pred zapisom v DB (da ne sproži TS narrowing-a kasneje)
  const nowSettled = st.status === "settled";

  await prisma.blackjackRound.update({
    where: { id: roundId },
    data: { state: st as any },
  });

  if (nowSettled) {
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
  if ((st.status as string) === "settled") {
    return res.status(400).json({ message: "Round settled" });
  }
  
  clearInsurance(st);

  const h = st.hands[st.active];
  if (!h || h.stood || h.cards.length !== 2) {
    return res.status(400).json({ message: "Cannot double now" });
  }

  // zaračunaj drugi del vložka
  const ok = await prisma.$transaction(async (tx) => {
    const w = round.currency === "BTC" ? "btcWallet" : "solWallet";
    const up = await (tx as any)[w].updateMany({
      where: { userId: round.userId!, balance: { gte: round.bet } },
      data: { balance: { decrement: round.bet } },
    });
    return up.count > 0;
  }).catch(() => false);

  if (!ok) return res.status(400).json({ message: "Insufficient balance" });

  // izvedi double
  h.bet += round.bet;
  h.doubled = true;
  h.cards.push(draw(st));
  const drawn = h.cards[h.cards.length - 1];
  h.stood = true;

  // izberi naslednjo ali zaključek; dealer vleče le, če je vsaj ena roka živa
  finishOrNext(st);

  // izračunaj settled ZDAJ in ga zapomni, da se izognemo TS2367 kasneje
  const nowSettled = st.status === "settled";

  await prisma.blackjackRound.update({
    where: { id: roundId },
    data: { state: st as any },
  });

  if (nowSettled) {
    const settle = await settleRound(prisma, round, st, drawn);
    return res.json(settle);
  }

  // sicer vrnemo dodano karto in novo vrednost roke
  return res.json({ card: drawn, value: handValue(h.cards) });
});

router.post("/split", async (req: AuthRequest, res) => {
  const { roundId } = req.body as { roundId?: string };
  if (!roundId) return res.status(400).json({ message: "Missing roundId" });

  const round = await prisma.blackjackRound.findUnique({ where: { id: roundId } });
  if (!round) return res.status(404).json({ message: "Round not found" });

  const st = round.state as unknown as BJState;
  // TS-safe primerjava, da se izognemo TS2367
  if ((st.status as string) === "settled") {
    return res.status(400).json({ message: "Round settled" });
  }
  
  clearInsurance(st);

  const h = st.hands[st.active];

  // dovoljeno le, če je trenutna roka par (ali mixed tens, če omogočeno) in ni re-splita
  if (!h || !canSplitHand(h.cards) || st.hands.length >= 2) {
    return res.status(400).json({ message: "Cannot split" });
  }

  // zaračunaj drugi del vložka
  const ok = await prisma.$transaction(async (tx) => {
    const w = round.currency === "BTC" ? "btcWallet" : "solWallet";
    const up = await (tx as any)[w].updateMany({
      where: { userId: round.userId!, balance: { gte: round.bet } },
      data: { balance: { decrement: round.bet } },
    });
    return up.count > 0;
  }).catch(() => false);

  if (!ok) return res.status(400).json({ message: "Insufficient balance" });

  // dejanski split: ena karta ostane v prvi roki, druga gre v novo roko; v vsako roko dodamo po eno novo karto
  const second = h.cards.pop()!;
  const h1 = { cards: [h.cards[0], draw(st)], bet: round.bet, stood: false, splitFrom: true };
  const h2 = { cards: [second,     draw(st)], bet: round.bet, stood: false, splitFrom: true };
  st.hands = [h1, h2];
  st.active = 0; // nadaljuj z roko 1

  await prisma.blackjackRound.update({
    where: { id: roundId },
    data: { state: st as any },
  });

  // frontend pričakuje { hands, canDouble }
  return res.json({
    hands: st.hands.map(x => x.cards),
    canDouble: true,
  });
});

router.post("/insurance", async (req: AuthRequest, res) => {
  const { roundId, take } = req.body as { roundId?: string; take?: boolean };
  if (!roundId) return res.status(400).json({ message: "Missing roundId" });

  const round = await prisma.blackjackRound.findUnique({ where: { id: roundId } });
  if (!round) return res.status(404).json({ message: "Round not found" });

  const st = round.state as unknown as BJState;
  if (st.status !== "playing") return res.status(400).json({ message: "Round settled" });
  if (!st.insuranceOffered) return res.status(400).json({ message: "Insurance not available" });

  // ⚠️ temelji na dejanski stavi roke (bolj robustno kot round.bet)
  const baseBet = st.hands[0]?.bet ?? round.bet ?? 0;

  let insuranceBet = 0;
  if (take) {
    insuranceBet = baseBet * 0.5;

    if (insuranceBet <= 0) {
      return res.status(400).json({ message: "Cannot take insurance on zero bet" });
    }

    const ok = await prisma.$transaction(async (tx) => {
      const w = round.currency === "BTC" ? "btcWallet" : "solWallet";
      const up = await (tx as any)[w].updateMany({
        where: { userId: round.userId!, balance: { gte: insuranceBet } },
        data: { balance: { decrement: insuranceBet } },
      });
      return up.count > 0;
    }).catch(() => false);

    if (!ok) return res.status(400).json({ message: "Insufficient balance for insurance" });

    st.insuranceBet = insuranceBet;
  }

  // po odločitvi (take ali no-take) insurance ne ponujamo več
  st.insuranceOffered = false;
  await prisma.blackjackRound.update({ where: { id: roundId }, data: { state: st as any } });

  return res.json({ ok: true, insuranceBet });
});

// ---------- settle ----------
async function settleRound(
  prisma: PrismaClient,
  round: any,
  st: BJState,
  playerCard?: number,
) {
  const dealerV = handValue(st.dealer);
  const dealerBJ = isBlackjack(st.dealer);

  let totalPayout = 0;

  // ✅ Insurance: izplača se samo, če ima dealer blackjack
  const insuranceBet = st.insuranceBet ?? 0;           // <-- varno "definiraj" kot number
const insurancePayout = insuranceBet > 0 && dealerBJ
  ? insuranceBet * 3                                  // 2:1 + vračilo vložka
  : 0;

  const outcomes: Array<{
    value: number;
    result: "win" | "lose" | "push" | "blackjack";
    payout: number;
  }> = [];

  for (const h of st.hands) {
    const v = handValue(h.cards);
    const playerNaturalBJ = isBlackjack(h.cards) && !h.splitFrom;

    let payout = 0;
    let result: "win" | "lose" | "push" | "blackjack" = "lose";

    if (dealerBJ && !playerNaturalBJ) {
      payout = 0; result = "lose";
    } else if (playerNaturalBJ) {
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

    // ✅ NE pozabi prišteti izplačila roke
    totalPayout += payout;
    outcomes.push({ value: v, result, payout });
  }

  // ✅ Insurance prištej samo enkrat, izven zanke
  totalPayout += insurancePayout;

  if (totalPayout > 0) {
    await prisma.$transaction(async (tx) => {
      const w = round.currency === "BTC" ? "btcWallet" : "solWallet";
      await (tx as any)[w].update({
        where: { userId: round.userId! },
        data: { balance: { increment: totalPayout } },
      });
    });
  }

  await prisma.blackjackRound.update({
    where: { id: round.id },
    data: { state: { ...st, status: "settled" } as any },
  });

  return {
    serverSeed: round.serverSeed,
    dealer: st.dealer,
    outcomes,
    totalPayout,
    ...(typeof playerCard === "number" ? { playerCard } : {}),
  };
}

export default router;
