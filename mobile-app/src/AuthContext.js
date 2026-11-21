import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState } from "react";
import { api, definirSessionExpiree } from "./api";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    definirSessionExpiree(() => setUser(null));
    AsyncStorage.getItem("user").then((u) => {
      if (u) setUser(JSON.parse(u));
      setChargement(false);
    });
  }, []);

  const ouvrir = async (data) => {
    await AsyncStorage.multiSet([["access", data.access], ["refresh", data.refresh], ["user", JSON.stringify(data.user)]]);
    setUser(data.user);
  };
  const login = async (email, password) => ouvrir(await api("/auth/login/", { method: "POST", auth: false, body: { email, password } }));
  const inscrire = (f) => api("/auth/register/", { method: "POST", auth: false, body: { nom: f.nom, email: f.email, telephone: f.telephone, adresse: f.adresse, password: f.password } });
  const verifier = async (email, code) => ouvrir(await api("/auth/verify-otp/", { method: "POST", auth: false, body: { email, code } }));
  const renvoyer = (email) => api("/auth/resend-otp/", { method: "POST", auth: false, body: { email } });
  const logout = async () => { await AsyncStorage.clear(); setUser(null); };

  return <Ctx.Provider value={{ user, chargement, login, inscrire, verifier, renvoyer, logout }}>{children}</Ctx.Provider>;
}
