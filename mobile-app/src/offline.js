import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";

const CLE_TOURNEE = "tournee_cache";
const CLE_FILE = "file_sync";

export const lireTournee = async () => JSON.parse((await AsyncStorage.getItem(CLE_TOURNEE)) || "[]");
export const sauverTournee = (liste) => AsyncStorage.setItem(CLE_TOURNEE, JSON.stringify(liste));
export const lireFile = async () => JSON.parse((await AsyncStorage.getItem(CLE_FILE)) || "[]");

export async function enfiler(op) {
  const file = await lireFile();
  file.push({ ...op, ts: Date.now() });
  await AsyncStorage.setItem(CLE_FILE, JSON.stringify(file));
}

/** Applique localement les opérations en attente pour que l'écran reste cohérent hors-ligne. */
export function appliquerFile(items, file) {
  const copie = items.map((i) => ({ ...i }));
  for (const op of file) {
    const it = copie.find((i) => i.id === op.id);
    if (!it) continue;
    if (op.action === "arrivee" && it.statut === "PLANIFIE") it.statut = "SUR_PLACE";
    if (op.action === "valider") it.statut = "EFFECTUE";
    if (op.action === "incident") it.statut = "ECHEC";
    it.en_attente_sync = true;
  }
  return copie;
}

/** Envoie la file au serveur. Retourne { envoyees, erreurs[] }. Lève si le réseau est indisponible. */
export async function synchroniser() {
  const file = await lireFile();
  if (!file.length) return { envoyees: 0, erreurs: [] };
  const r = await api("/planning/sync/", { method: "POST", body: { operations: file } });
  const restantes = (await lireFile()).slice(file.length); // opérations ajoutées pendant l'envoi
  await AsyncStorage.setItem(CLE_FILE, JSON.stringify(restantes));
  return { envoyees: file.length, erreurs: r.resultats.filter((x) => !x.ok).map((x) => x.erreur) };
}
