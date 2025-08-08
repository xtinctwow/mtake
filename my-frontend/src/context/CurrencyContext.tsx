import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Currency = "BTC" | "SOL";

interface CurrencyContextType {
  selectedCurrency: Currency;
  setSelectedCurrency: (currency: Currency) => void;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(() => {
    const saved = localStorage.getItem("selectedCurrency");
    return saved === "BTC" || saved === "SOL" ? saved : "BTC";
  });

  // Shrani v localStorage pri spremembi
  useEffect(() => {
    localStorage.setItem("selectedCurrency", selectedCurrency);
  }, [selectedCurrency]);

  // Poslušaj spremembe iz drugih zavihkov/oken
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === "selectedCurrency" && (event.newValue === "BTC" || event.newValue === "SOL")) {
        setSelectedCurrency(event.newValue);
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return (
    <CurrencyContext.Provider value={{ selectedCurrency, setSelectedCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context;
};
