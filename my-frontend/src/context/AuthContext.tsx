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
  username: string | null;
  isAuthenticated: boolean;
  // accept username optionally (e.g., from OAuth redirect or API responses)
  login: (token: string, email?: string, username?: string | null) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Storage keys (keep existing to avoid breaking)
const LS_TOKEN = "token";
const LS_EMAIL = "email";
const LS_USERNAME = "username";
// Only to trigger 'storage' events (cross-tab fallback)
const LS_EVENT = "auth_event";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Hydrate from localStorage once
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(LS_TOKEN));
  const [email, setEmail] = useState<string | null>(() => localStorage.getItem(LS_EMAIL));
  const [username, setUsername] = useState<string | null>(() => localStorage.getItem(LS_USERNAME));

  // BroadcastChannel for instant cross-tab sync (if supported)
  const bc = useMemo(() => {
    try {
      return new BroadcastChannel("auth");
    } catch {
      return null;
    }
  }, []);

  /** Local mutators (do NOT broadcast) */
  const applyLogin = (tk: string, em?: string | null, un?: string | null) => {
    setToken(tk);
    localStorage.setItem(LS_TOKEN, tk);

    if (em !== undefined) {
      setEmail(em ?? null);
      if (em === null) localStorage.removeItem(LS_EMAIL);
      else localStorage.setItem(LS_EMAIL, em);
    } else {
      // keep whatever is already there
      const existingEmail = localStorage.getItem(LS_EMAIL);
      setEmail(existingEmail);
    }

    if (un !== undefined) {
      setUsername(un ?? null);
      if (un === null) localStorage.removeItem(LS_USERNAME);
      else localStorage.setItem(LS_USERNAME, un);
    } else {
      const existingUsername = localStorage.getItem(LS_USERNAME);
      setUsername(existingUsername);
    }
  };

  const applyLogout = () => {
    setToken(null);
    setEmail(null);
    setUsername(null);
    localStorage.removeItem(LS_TOKEN);
    localStorage.removeItem(LS_EMAIL);
    localStorage.removeItem(LS_USERNAME);
  };

  /** Public API — broadcasts to other tabs */
  const login = (tk: string, em?: string, un?: string | null) => {
    applyLogin(tk, em ?? undefined, un ?? undefined);
    bc?.postMessage({
      type: "login",
      token: tk,
      email: em ?? localStorage.getItem(LS_EMAIL),
      username: un ?? localStorage.getItem(LS_USERNAME),
    });
    localStorage.setItem(LS_EVENT, JSON.stringify({ t: Date.now(), type: "login" }));
  };

  const logout = () => {
    applyLogout();
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
        applyLogin(
          data.token,
          typeof data.email === "string" ? data.email : undefined,
          typeof data.username === "string" ? data.username : undefined
        );
      }
    };
    bc.addEventListener("message", onMessage);
    return () => bc.removeEventListener("message", onMessage);
  }, [bc]);

  /** Fallback: window 'storage' events */
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_EVENT && e.newValue) {
        try {
          const { type } = JSON.parse(e.newValue);
          if (type === "logout") {
            applyLogout();
          } else if (type === "login") {
            const tk = localStorage.getItem(LS_TOKEN);
            const em = localStorage.getItem(LS_EMAIL);
            const un = localStorage.getItem(LS_USERNAME);
            if (tk) applyLogin(tk, em ?? undefined, un ?? undefined);
          }
        } catch {
          // ignore malformed
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
      username,
      isAuthenticated: !!token,
      login,
      logout,
    }),
    [token, email, username]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};
