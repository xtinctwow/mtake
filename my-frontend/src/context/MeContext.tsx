// src/context/MeContext.tsx
import React, {createContext, useContext, useEffect, useState} from "react";
import { useAuth } from "./AuthContext";
import { useCurrency } from "./CurrencyContext";

type MeData = {
  email: string;
  username: string | null;
  balances?: { BTC?: number; SOL?: number };
  addresses?: { BTC?: string | null; SOL?: string | null };
} | null;

type MeState = { data: MeData; ready: boolean };

const Ctx = createContext<MeState>({ data: null, ready: false });

export const MeProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const { token } = useAuth();
  const { setBalances } = useCurrency();

  const [data, setData] = useState<MeData>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    if (!token) {
      setData(null);
      setReady(true);     // nič za preverit
      return;
    }

    setReady(false);       // začnemo preverjati
    (async () => {
      try {
        const r = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
        if (!active) return;
        if (!r.ok) { setData(null); setReady(true); return; }

        const json = await r.json();
        if (!active) return;

        setData(json);
        if (json?.balances) {
          setBalances({
            BTC: typeof json.balances.BTC === "number" ? json.balances.BTC : undefined,
            SOL: typeof json.balances.SOL === "number" ? json.balances.SOL : undefined,
          });
        }
        setReady(true);
      } catch {
        if (active) { setData(null); setReady(true); }
      }
    })();

    return () => { active = false; };
  }, [token, setBalances]);

  return <Ctx.Provider value={{ data, ready }}>{children}</Ctx.Provider>;
};

export const useMe = () => useContext(Ctx);
