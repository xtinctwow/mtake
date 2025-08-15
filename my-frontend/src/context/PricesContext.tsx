// src/context/PricesContext.tsx
import React, { createContext, useContext, useEffect, useRef, useState } from "react";

type Prices = { BTC?: number; SOL?: number };
const Ctx = createContext<Prices>({});

const POLL_MS_VISIBLE = 60_000;   // 60s when tab visible
const POLL_MS_HIDDEN  = Infinity; // effectively paused

export const PricesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [prices, setPrices] = useState<Prices>({});
  const intervalRef = useRef<number | null>(null);
  const runningRef = useRef(false); // guard against StrictMode double-invoke
  const lastFetchRef = useRef(0);

  async function load() {
    // (tiny debounce so we don't hammer right after visibilitychange)
    const now = Date.now();
    if (now - lastFetchRef.current < 1_000) return;
    lastFetchRef.current = now;

    try {
      const r = await fetch(`${import.meta.env.VITE_API_URL}/api/wallet/prices`, {
        // if you want stronger caching behavior, add headers like:
        // cache: "no-cache",
      });
      if (!r.ok) return;
      const data = await r.json();
      setPrices(data);
    } catch {
      // swallow network errors
    }
  }

  // start/stop polling depending on page visibility
  function startPolling() {
    stopPolling();
    const delay = document.hidden ? POLL_MS_HIDDEN : POLL_MS_VISIBLE;
    if (!isFinite(delay)) return; // paused
    intervalRef.current = window.setInterval(load, delay);
  }

  function stopPolling() {
    if (intervalRef.current != null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  useEffect(() => {
    if (runningRef.current) return; // guard StrictMode double mount
    runningRef.current = true;

    // initial fetch
    load();
    // start polling
    startPolling();

    const onVis = () => {
      // when tab becomes visible, fetch immediately (debounced) and restart timer
      if (!document.hidden) load();
      startPolling();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      stopPolling();
      runningRef.current = false;
    };
  }, []);

  return <Ctx.Provider value={prices}>{children}</Ctx.Provider>;
};

export const usePrices = () => useContext(Ctx);
