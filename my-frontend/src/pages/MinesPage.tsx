// src/pages/MinesPage.tsx
import MinesProd from "@/games/MinesProd";
import { useAuth } from "@/context/AuthContext";
import { useCurrency } from "@/context/CurrencyContext";

export default function MinesPage() {
  const api = import.meta.env.VITE_API_URL;
  const { token } = useAuth();
  const { selectedCurrency } = useCurrency();

  const authHeaders = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  // 1) Commit (rezervira stake, vrne roundId + serverSeedHash + server nonce)
  const onPlaceBet = async (
    bet: number,
    params: { mines: number; currency: "BTC" | "SOL" },
    seeds: { clientSeed: string; nonce: number }
  ) => {
    const res = await fetch(`${api}/api/mines/place-bet`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        bet,
        mines: params.mines,
        currency: params.currency,
        seeds: { clientSeed: seeds.clientSeed },
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.message || "place-bet failed");
    }
    return res.json();
  };

  // 2) Reveal en tile
  const onReveal = async (roundId: string, index: number) => {
    const res = await fetch(`${api}/api/mines/reveal`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ roundId, index }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.message || "reveal failed");
    }
    return res.json();
  };

  // 3) Cashout – server vrne serverSeed + payout in nakaže denar
  const onCashout = async (roundId: string, safeRevealed: number) => {
    const res = await fetch(`${api}/api/mines/cashout`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ roundId, safeRevealed }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.message || "cashout failed");
    }
    return res.json();
  };

  return (
    <MinesProd
      onPlaceBet={onPlaceBet}
      onReveal={onReveal}
      onCashout={onCashout}
      minBet={0} // podpiramo "free roll", če želiš
      maxBet={1000}
      houseEdge={0.01}
    />
  );
}
