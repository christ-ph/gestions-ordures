import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "./config";

let surSessionExpiree = () => {};
export const definirSessionExpiree = (fn) => { surSessionExpiree = fn; };

async function requete(path, method, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(API_URL + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
}

export async function api(path, { method = "GET", body, auth = true } = {}) {
  let res = await requete(path, method, body, auth ? await AsyncStorage.getItem("access") : null);
  if (res.status === 401 && auth) {
    const refresh = await AsyncStorage.getItem("refresh");
    const r = refresh ? await requete("/auth/refresh/", "POST", { refresh }) : null;
    if (r && r.ok) {
      const access = (await r.json()).access;
      await AsyncStorage.setItem("access", access);
      res = await requete(path, method, body, access);
    } else {
      await AsyncStorage.multiRemove(["access", "refresh", "user"]);
      surSessionExpiree();
    }
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.erreur || "Erreur serveur"), { status: res.status, data });
  return data;
}
