// src/pages/PlinkoPage.tsx
import PlinkoProd from "../games/PlinkoProd";
import { useAuth } from "../context/AuthContext";
import { useCurrency } from "../context/CurrencyContext";
import { useRef } from "react";

type Cur = "BTC" | "SOL";
type RoundMeta = {
  currency: Cur;
  bet: number;
  reserved: boolean;   // ali smo lokalno že odšteli -bet na place
  payout?: number;     // payout iz /resolve (vključuje stake)
  resolved?: boolean;  // /resolve je vrnil podatke
  landed?: boolean;    // animacija je končana (onSettle)
  settled?: boolean;   // že poravnano v DB in lokalno
};

export default function PlinkoPage() {
  const api = import.meta.env.VITE_API_URL;
  const { token } = useAuth();
  const { selectedCurrency, adjustBalance } = useCurrency();

  // roundId -> meta o rundi (token-local UI bookkeeping)
  const roundsRef = useRef<Map<string, RoundMeta>>(new Map());

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const onPlaceBet: Parameters<typeof PlinkoProd>[0]["onPlaceBet"] = async (bet, params, seeds) => {
    const currencyAtBet = selectedCurrency as Cur;

    const r = await fetch(`${api}/api/plinko/place-bet`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        bet,
        params,
        currency: currencyAtBet,
        seeds: { clientSeed: seeds.clientSeed },
      }),
    });

    if (!r.ok) throw await r.json().catch(() => ({ message: "place-bet failed" }));
    const data = await r.json(); // { roundId, clientSeed, nonce, serverSeedHash }

    // takoj lokalno rezerviramo stake (da UI sledi DB znižanju)
    let reserved = false;
    if (bet > 0) {
      adjustBalance(currencyAtBet, -bet);
      reserved = true;
    }

    roundsRef.current.set(data.roundId, {
      currency: currencyAtBet,
      bet,
      reserved,
      resolved: false,
      landed: false,
      settled: false,
    });

    return data;
  };

  const onResolve: Parameters<typeof PlinkoProd>[0]["onResolve"] = async (roundId) => {
    // Pomembno: povej backendu, naj NE kreditira še (credit:false)
    const r = await fetch(`${api}/api/plinko/resolve`, {
      method: "POST",
      headers,
      body: JSON.stringify({ roundId, credit: false }),
    });

    if (!r.ok) throw await r.json().catch(() => ({ message: "resolve failed" }));
    const data = await r.json(); // { serverSeed, payout, index, path, rows, risk, multiplier }

    // Zabeležimo payout, NE prilagajamo balance tukaj.
    const meta = roundsRef.current.get(roundId);
    if (meta) {
      meta.payout = Number(data?.payout ?? 0);
      meta.resolved = true;
      roundsRef.current.set(roundId, meta);
      // poravnavo bomo izvedli v onSettle po uspešnem /settle
    } else {
      // fallback (po reloadu): ustvarimo minimalen meta zapis; poravnamo v onSettle
      roundsRef.current.set(roundId, {
        currency: selectedCurrency as Cur,
        bet: 0,
        reserved: false,
        payout: Number(data?.payout ?? 0),
        resolved: true,
        landed: false,
        settled: false,
      });
    }

    return data;
  };

  // Kliče ga FE šele, ko žogica pristane (po animaciji)
  const onSettle: Parameters<typeof PlinkoProd>[0]["onSettle"] = async (roundId) => {
    const meta = roundsRef.current.get(roundId);

    // če smo že poravnali, nič
    if (meta?.settled) return;

    try {
      // 1) poravnaj na backendu (idempotentno)
      const r = await fetch(`${api}/api/plinko/settle`, {
        method: "POST",
        headers,
        body: JSON.stringify({ roundId }),
      });

      if (!r.ok) {
        // če je že poravnano na BE, naj vrne 409/200 z "already settled" – tu lahko ignoriraš
        const err = await r.json().catch(() => ({} as any));
        console.warn("settle warn:", err);
      }

      const resp = await r.json().catch(() => ({} as any));
      const payoutFromBE = Number(resp?.payout);

      // 2) lokalni net popravek – šele po uspešnem settle (da se sklada z /me)
      const m = meta || {
        currency: selectedCurrency as Cur,
        bet: 0,
        reserved: false,
        payout: undefined,
        resolved: false,
      };

      const currency = m.currency;
      const bet = Number(m.bet ?? 0);
      const payout = Number(
        // preferiraj znesek, ki ga je BE vrnil iz /settle; sicer uporabi iz /resolve
        Number.isFinite(payoutFromBE) ? payoutFromBE : m.payout ?? 0
      );

      // NET = payout - bet  (payout = bet * multiplier, stake-included)
      const netDelta = m.reserved ? payout : (payout - bet);
      if (netDelta !== 0) adjustBalance(currency, netDelta);

      // 3) označi kot settled in počisti
      if (meta) {
        meta.landed = true;
        meta.settled = true;
        roundsRef.current.set(roundId, meta);
      }
      roundsRef.current.delete(roundId);
    } catch (e) {
      console.error("onSettle error:", e);
      // meta ostane v map-i; lahko dodaš retry/logiko po potrebi
    }
  };

  return (
    <PlinkoProd
      onPlaceBet={onPlaceBet}
      onResolve={onResolve}
      onSettle={onSettle}   // ← poravnava po pristanku (po /settle)
      minBet={0}
      maxBet={1000}
      houseEdge={0.01}
    />
  );
}
