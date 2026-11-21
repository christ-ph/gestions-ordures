const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

async function requete(path, method, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
}

export async function api(path, { method = "GET", body, auth = true } = {}) {
  let res = await requete(path, method, body, auth ? localStorage.getItem("access") : null);
  if (res.status === 401 && auth && localStorage.getItem("refresh")) {
    const r = await requete("/auth/refresh/", "POST", { refresh: localStorage.getItem("refresh") });
    if (r.ok) {
      localStorage.setItem("access", (await r.json()).access);
      res = await requete(path, method, body, localStorage.getItem("access"));
    } else {
      localStorage.clear();
      window.dispatchEvent(new Event("session-expiree"));
    }
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.erreur || "Erreur serveur"), { status: res.status, data });
  return data;
}
