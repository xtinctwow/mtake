// src/pages/BlackjackPage.tsx
import BlackjackProd from "../games/BlackjackProd";
import { useAuth } from "../context/AuthContext";
import { useCurrency } from "../context/CurrencyContext";

export default function BlackjackPage(){
  const api = import.meta.env.VITE_API_URL;
  const { token } = useAuth();
  const headers = {
    "Content-Type":"application/json",
    ...(token ? { Authorization:`Bearer ${token}` } : {}),
  };

  return (
    <BlackjackProd
      onPlaceBet={(bet, {currency}, seeds) =>
        fetch(`${api}/api/blackjack/place-bet`, {
          method:"POST", headers,
          body: JSON.stringify({ bet, currency, seeds:{ clientSeed: seeds.clientSeed } }),
        }).then(async r=> r.ok ? r.json() : Promise.reject(await r.json().catch(()=>({message:"place-bet failed"}))))}
      onHit={(roundId)=>
        fetch(`${api}/api/blackjack/hit`, { method:"POST", headers, body: JSON.stringify({ roundId }) })
        .then(async r=> r.ok ? r.json() : Promise.reject(await r.json().catch(()=>({message:"hit failed"}))))}
      onStand={(roundId)=>
        fetch(`${api}/api/blackjack/stand`, { method:"POST", headers, body: JSON.stringify({ roundId }) })
        .then(async r=> r.ok ? r.json() : Promise.reject(await r.json().catch(()=>({message:"stand failed"}))))}
      onDouble={(roundId)=>
        fetch(`${api}/api/blackjack/double`, { method:"POST", headers, body: JSON.stringify({ roundId }) })
        .then(async r=> r.ok ? r.json() : Promise.reject(await r.json().catch(()=>({message:"double failed"}))))}
      onSplit={(roundId)=>
        fetch(`${api}/api/blackjack/split`, { method:"POST", headers, body: JSON.stringify({ roundId }) })
        .then(async r=> r.ok ? r.json() : Promise.reject(await r.json().catch(()=>({message:"split failed"}))))}
      onInsurance={(roundId, take)=>
        fetch(`${api}/api/blackjack/insurance`, { method:"POST", headers, body: JSON.stringify({ roundId, take }), })
        .then(async r=> r.ok ? r.json() : Promise.reject(await r.json().catch(()=>({message:"insurance failed"}))))}
    />
  );
}
