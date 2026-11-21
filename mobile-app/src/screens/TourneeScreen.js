import NetInfo from "@react-native-community/netinfo";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, FlatList, Modal, RefreshControl, Text, View } from "react-native";
import { api } from "../api";
import { appliquerFile, enfiler, lireFile, lireTournee, sauverTournee, synchroniser } from "../offline";
import { Bouton, Carte, Pastille, couleurStatut } from "../ui";

const PRIORITES = { 1: "EXPRESS", 2: "VIP", 3: "STANDARD" };

export default function TourneeScreen() {
  const [items, setItems] = useState([]);
  const [enLigne, setEnLigne] = useState(true);
  const [attente, setAttente] = useState(0);
  const [rafraichit, setRafraichit] = useState(false);
  const [scan, setScan] = useState(null);
  const [perm, demanderPerm] = useCameraPermissions();
  const verrou = useRef(false);
  const dejaScanne = useRef(false);

  /** Synchronise la file puis recharge la tournée (cache local si hors-ligne). */
  const rafraichir = useCallback(async () => {
    if (verrou.current) return;
    verrou.current = true;
    try {
      let liste;
      try {
        const bilan = await synchroniser();
        if (bilan.erreurs.length) Alert.alert("Synchronisation", `${bilan.erreurs.length} opération(s) refusée(s) :\n${bilan.erreurs.join("\n")}`);
        const d = await api("/planning/");
        liste = d.items;
        await sauverTournee(liste);
        setEnLigne(true);
      } catch {
        liste = await lireTournee();
        setEnLigne(false);
      }
      const file = await lireFile();
      setAttente(file.length);
      setItems(appliquerFile(liste, file));
    } finally { verrou.current = false; }
  }, []);

  useEffect(() => {
    rafraichir();
    const unsub = NetInfo.addEventListener((s) => { if (s.isConnected) rafraichir(); });
    const t = setInterval(rafraichir, 20000);
    return () => { unsub(); clearInterval(t); };
  }, [rafraichir]);

  const position = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return {};
    try {
      const p = await Location.getCurrentPositionAsync({});
      return { latitude: p.coords.latitude, longitude: p.coords.longitude };
    } catch { return {}; }
  };

  const arrive = async (it) => { await enfiler({ action: "arrivee", id: it.id, ...(await position()) }); rafraichir(); };

  const validerGps = async (it) => {
    const pos = await position();
    if (pos.latitude === undefined) return Alert.alert("GPS indisponible", "Activez la localisation ou scannez le QR Code.");
    await enfiler({ action: "valider", id: it.id, ...pos });
    rafraichir();
  };

  const ouvrirScan = async (it) => {
    if (!perm?.granted) { const r = await demanderPerm(); if (!r.granted) return Alert.alert("Caméra refusée"); }
    dejaScanne.current = false;
    setScan(it);
  };

  const surCode = async ({ data }) => {
    if (dejaScanne.current || !scan) return;
    dejaScanne.current = true;
    const cible = scan;
    setScan(null);
    await enfiler({ action: "valider", id: cible.id, qr: data });
    rafraichir();
  };

  const incident = (it) =>
    Alert.alert("Signaler un incident", "Motif ?", [
      { text: "Bac absent", onPress: async () => { await enfiler({ action: "incident", id: it.id, motif: "Bac absent" }); rafraichir(); } },
      { text: "Accès impossible", onPress: async () => { await enfiler({ action: "incident", id: it.id, motif: "Accès impossible" }); rafraichir(); } },
      { text: "Annuler", style: "cancel" },
    ]);

  return (
    <View className="flex-1 bg-background-primary">
      <View className={`${enLigne ? "bg-primary-100" : "bg-secondary-200"} px-4 py-2`}>
        <Text className="text-sm font-medium text-primary-text">
          {enLigne ? "🟢 En ligne" : "🟠 Hors-ligne (données locales)"}{attente > 0 ? ` · ${attente} opération(s) à synchroniser` : ""}
        </Text>
      </View>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 12 }}
        refreshControl={<RefreshControl refreshing={rafraichit} onRefresh={async () => { setRafraichit(true); await rafraichir(); setRafraichit(false); }} />}
        ListEmptyComponent={<Text className="text-center text-secondary-text mt-10">Aucune collecte planifiée aujourd'hui</Text>}
        renderItem={({ item: it }) => (
          <Carte>
            <View className="flex-row justify-between items-center mb-1">
              <Text className="text-lg font-bold text-primary-text">#{it.ordre_passage} · {it.point.adresse || "Point de collecte"}</Text>
              <Pastille texte={it.statut} couleur={couleurStatut(it.statut)} />
            </View>
            <Text className="text-secondary-text">Zone {it.point.zone} · {it.point.poids_estime} kg · {PRIORITES[it.priorite]}</Text>
            <Text className="text-secondary-text text-xs mb-3">Client : {it.point.client_nom}{it.en_attente_sync ? " · ⏳ en attente de sync" : ""}</Text>
            {it.statut === "PLANIFIE" && <Bouton titre="📍 Je suis arrivé" variante="orange" onPress={() => arrive(it)} className="mb-2" />}
            {(it.statut === "PLANIFIE" || it.statut === "SUR_PLACE") && (
              <>
                <Bouton titre="Valider la collecte (Scan QR)" onPress={() => ouvrirScan(it)} className="mb-2" />
                <Bouton titre="Valider par GPS" variante="gris" onPress={() => validerGps(it)} className="mb-2" />
                <Bouton titre="Signaler un incident" variante="rouge" onPress={() => incident(it)} />
              </>
            )}
            {it.statut === "EFFECTUE" && <Text className="text-primary-600 font-semibold">✅ Collecte validée</Text>}
            {it.statut === "ECHEC" && <Text className="text-error font-semibold">❌ Incident signalé</Text>}
          </Carte>
        )}
      />
      <Modal visible={!!scan} animationType="slide" onRequestClose={() => setScan(null)}>
        <View className="flex-1 bg-black">
          <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={surCode} />
          <View className="p-4 bg-black"><Bouton titre="Annuler" variante="gris" onPress={() => setScan(null)} /></View>
        </View>
      </Modal>
    </View>
  );
}
