import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("user") || "null"));

  const ouvrirSession = (data) => {
    localStorage.setItem("access", data.access);
    localStorage.setItem("refresh", data.refresh);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
  };
  const deconnexion = () => {
    localStorage.clear();
    setUser(null);
  };
  const rafraichir = useCallback(async () => {
    const u = await api("/auth/me/");
    localStorage.setItem("user", JSON.stringify(u));
    setUser(u);
  }, []);

  useEffect(() => {
    const h = () => setUser(null);
    window.addEventListener("session-expiree", h);
    return () => window.removeEventListener("session-expiree", h);
  }, []);

  return <Ctx.Provider value={{ user, ouvrirSession, deconnexion, rafraichir }}>{children}</Ctx.Provider>;
}
