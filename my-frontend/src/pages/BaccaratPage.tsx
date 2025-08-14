// src/pages/BaccaratPage.tsx
import BaccaratProd from "../games/BaccaratProd";
import { useAuth } from "../context/AuthContext";
import { useCurrency } from "../context/CurrencyContext";

export default function BaccaratPage() {
  const api = import.meta.env.VITE_API_URL;
  const { token } = useAuth();
  const { selectedCurrency } = useCurrency();

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  return (
    <BaccaratProd
      /** bets: { player?: number; banker?: number; tie?: number; playerPair?: number; bankerPair?: number } */
      onPlaceBet={(bets, _params, seeds) =>
        fetch(`${api}/api/baccarat/place-bet`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            bets,
            currency: selectedCurrency,
            seeds: { clientSeed: seeds.clientSeed },
          }),
        }).then(async (r) =>
          r.ok ? r.json() : Promise.reject(await r.json().catch(() => ({ message: "place-bet failed" })))
        )
      }
      onResolve={(roundId) =>
        fetch(`${api}/api/baccarat/resolve`, {
          method: "POST",
          headers,
          body: JSON.stringify({ roundId }),
        }).then(async (r) =>
          r.ok ? r.json() : Promise.reject(await r.json().catch(() => ({ message: "resolve failed" })))
        )
      }
      minBet={0}
      maxBet={1000}
      /** Primary house edge reference (Banker ~1.06%). UI can show per-bet edges inside the game */
      houseEdge={0.0106}
    />
  );
}
