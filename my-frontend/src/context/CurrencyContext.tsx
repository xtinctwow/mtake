// src/context/CurrencyContext.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Currency = "BTC" | "SOL";

interface CurrencyContextType {
  selectedCurrency: Currency;
  setSelectedCurrency: (currency: Currency) => void;

  btcBalance: number;
  solBalance: number;

  // nastavi oba (ali samo enega) iz API-ja
  setBalances: (b: { BTC?: number; SOL?: number }) => void;

  // instant lokalna prilagoditev (rezervacija/payout)
  adjustBalance: (currency: Currency, delta: number) => void;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(() => {
    const saved = localStorage.getItem("selectedCurrency");
    return saved === "BTC" || saved === "SOL" ? saved : "BTC";
  });

  const [btcBalance, setBtcBalance] = useState<number>(() => {
    const saved = localStorage.getItem("btcBalance");
    return saved ? Number(saved) : 0;
  });

  const [solBalance, setSolBalance] = useState<number>(() => {
    const saved = localStorage.getItem("solBalance");
    return saved ? Number(saved) : 0;
  });

  // persist izbrano valuto
  useEffect(() => {
    localStorage.setItem("selectedCurrency", selectedCurrency);
  }, [selectedCurrency]);

  // helperji
  const setBalances = (b: { BTC?: number; SOL?: number }) => {
    if (typeof b.BTC === "number") {
      setBtcBalance(b.BTC);
      localStorage.setItem("btcBalance", String(b.BTC));
    }
    if (typeof b.SOL === "number") {
      setSolBalance(b.SOL);
      localStorage.setItem("solBalance", String(b.SOL));
    }
  };

  const adjustBalance = (currency: Currency, delta: number) => {
    if (currency === "BTC") {
      setBtcBalance((prev) => {
        const next = Number((prev + delta).toFixed(8));
        localStorage.setItem("btcBalance", String(next));
        return next;
      });
    } else {
      setSolBalance((prev) => {
        const next = Number((prev + delta).toFixed(8));
        localStorage.setItem("solBalance", String(next));
        return next;
      });
    }
  };

  // sync med zavihki (če drug zavihek spremeni localStorage)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "selectedCurrency" && (e.newValue === "BTC" || e.newValue === "SOL")) {
        setSelectedCurrency(e.newValue);
      }
      if (e.key === "btcBalance" && e.newValue != null) {
        setBtcBalance(Number(e.newValue));
      }
      if (e.key === "solBalance" && e.newValue != null) {
        setSolBalance(Number(e.newValue));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <CurrencyContext.Provider
      value={{
        selectedCurrency,
        setSelectedCurrency,
        btcBalance,
        solBalance,
        setBalances,
        adjustBalance,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within a CurrencyProvider");
  return ctx;
};
