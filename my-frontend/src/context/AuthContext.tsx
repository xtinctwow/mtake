// src/context/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type AuthContextType = {
  token: string | null;
  email: string | null;
  isAuthenticated: boolean;
  login: (token: string, email?: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Keep your existing keys to avoid breaking current storage
const LS_TOKEN = "token";
const LS_EMAIL = "email";
// Used only to trigger the 'storage' event between tabs as a fallback
const LS_EVENT = "auth_event";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize from localStorage once (avoids a flash of logged-out)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(LS_TOKEN));
  const [email, setEmail] = useState<string | null>(() => localStorage.getItem(LS_EMAIL));

  // BroadcastChannel for instant cross-tab sync (if supported)
  const bc = useMemo(() => {
    try {
      return new BroadcastChannel("auth");
    } catch {
      return null;
    }
  }, []);

  /** Local mutators that do NOT broadcast by themselves */
  const applyLogin = (tk: string, em?: string) => {
    setToken(tk);
    localStorage.setItem(LS_TOKEN, tk);
    if (em !== undefined) {
      setEmail(em);
      if (em === null) {
        localStorage.removeItem(LS_EMAIL);
      } else {
        localStorage.setItem(LS_EMAIL, em);
      }
    } else {
      // If no email param provided, keep whatever is already there
      const existingEmail = localStorage.getItem(LS_EMAIL);
      setEmail(existingEmail);
    }
  };

  const applyLogout = () => {
    setToken(null);
    setEmail(null);
    localStorage.removeItem(LS_TOKEN);
    localStorage.removeItem(LS_EMAIL);
  };

  /** Public API — broadcasts to other tabs */
  const login = (tk: string, em?: string) => {
    applyLogin(tk, em);
    // Notify other tabs
    bc?.postMessage({ type: "login", token: tk, email: em ?? localStorage.getItem(LS_EMAIL) });
    localStorage.setItem(LS_EVENT, JSON.stringify({ t: Date.now(), type: "login" }));
  };

  const logout = () => {
    applyLogout();
    // Notify other tabs
    bc?.postMessage({ type: "logout" });
    localStorage.setItem(LS_EVENT, JSON.stringify({ t: Date.now(), type: "logout" }));
  };

  /** Listen for BroadcastChannel messages */
  useEffect(() => {
    if (!bc) return;
    const onMessage = (e: MessageEvent) => {
      const data = e.data || {};
      if (data.type === "logout") {
        applyLogout();
      } else if (data.type === "login" && typeof data.token === "string") {
        // Accept email if provided; otherwise keep existing
        applyLogin(data.token, typeof data.email === "string" ? data.email : undefined);
      }
    };
    bc.addEventListener("message", onMessage);
    return () => bc.removeEventListener("message", onMessage);
  }, [bc]);

  /** Fallback: storage events (fires in other tabs, not the one making the change) */
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      // Unified event key
      if (e.key === LS_EVENT && e.newValue) {
        try {
          const { type } = JSON.parse(e.newValue);
          if (type === "logout") {
            applyLogout();
          } else if (type === "login") {
            const tk = localStorage.getItem(LS_TOKEN);
            const em = localStorage.getItem(LS_EMAIL) ?? undefined;
            if (tk) applyLogin(tk, em);
          }
        } catch {
          // ignore malformed events
        }
      }

      // Defensive: if token is cleared directly, logout
      if (e.key === LS_TOKEN && e.newValue === null) {
        applyLogout();
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo(
    () => ({
      token,
      email,
      isAuthenticated: !!token,
      login,
      logout,
    }),
    [token, email]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};
