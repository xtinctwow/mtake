import React from "react";
import { useAuth } from "../context/AuthContext";
import { useCurrency } from "../context/CurrencyContext";
import LimboProd from "../games/LimboProd";

export default function LimboPage() {
  const api = import.meta.env.VITE_API_URL;
  const { token } = useAuth();
  const { selectedCurrency } = useCurrency();

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const onPlaceBet = async (
    bet: number,
    params: { target: number; currency: "BTC" | "SOL" },
    seeds: { clientSeed: string; nonce: number }
  ) => {
    const res = await fetch(`${api}/api/limbo/place-bet`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        bet,
        target: params.target,
        currency: selectedCurrency,
        seeds: { clientSeed: seeds.clientSeed },
      }),
    });
    if (!res.ok) throw await res.json().catch(() => ({ message: "place-bet failed" }));
    return res.json();
  };

  const onResolve = async (roundId: string) => {
    const res = await fetch(`${api}/api/limbo/resolve`, {
      method: "POST",
      headers,
      body: JSON.stringify({ roundId }),
    });
    if (!res.ok) throw await res.json().catch(() => ({ message: "resolve failed" }));
    return res.json();
  };

  return (
    <LimboProd
      onPlaceBet={onPlaceBet}
      onResolve={onResolve}
      minBet={0}         // podpiramo free-roll
      maxBet={1000}
      houseEdge={0.01}
    />
  );
}
