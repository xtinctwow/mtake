// src/context/MeContext.tsx
import React, {createContext, useContext, useEffect, useState} from "react";
import { useAuth } from "./AuthContext";

type Me = { email: string; username: string | null } | null;
const Ctx = createContext<Me>(null);

export const MeProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const { token } = useAuth();
  const [me, setMe] = useState<Me>(null);

  useEffect(() => {
    let active = true;
    if (!token) { setMe(null); return; }

    (async () => {
      try {
        const r = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
        if (!r.ok) return;
        const data = await r.json();
        if (active) setMe(data);
      } catch {}
    })();

    return () => { active = false; };
  }, [token]);

  return <Ctx.Provider value={me}>{children}</Ctx.Provider>;
};

export const useMe = () => useContext(Ctx);
