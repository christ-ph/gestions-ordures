import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { api } from "../api";
import { Carte, Pastille, couleurStatut } from "../ui";

const MESSAGES = {
  PLANIFIE: "Collecte planifiée", SUR_PLACE: "🚨 Votre éboueur est arrivé devant votre point !",
  EFFECTUE: "✅ Collecte effectuée", ECHEC: "❌ Collecte impossible",
};

export default function SuiviScreen() {
  const [items, setItems] = useState([]);
  const [rafraichit, setRafraichit] = useState(false);
  const charger = useCallback(async () => {
    try { setItems((await api("/planning/")).items); } catch {}
  }, []);
  useEffect(() => { charger(); const t = setInterval(charger, 10000); return () => clearInterval(t); }, [charger]); // suivi quasi temps réel

  return (
    <FlatList
      className="bg-background-primary"
      data={items} keyExtractor={(i) => i.id} contentContainerStyle={{ padding: 12 }}
      refreshControl={<RefreshControl refreshing={rafraichit} onRefresh={async () => { setRafraichit(true); await charger(); setRafraichit(false); }} />}
      ListEmptyComponent={<Text className="text-center text-secondary-text mt-10">Aucune collecte à venir</Text>}
      renderItem={({ item: p }) => (
        <Carte className={p.statut === "SUR_PLACE" ? "border-2 border-secondary-400" : ""}>
          <View className="flex-row justify-between items-center mb-1">
            <Text className="font-bold text-lg text-primary-text">{new Date(p.date_tournee).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</Text>
            <Pastille texte={p.statut} couleur={couleurStatut(p.statut)} />
          </View>
          <Text className="text-secondary-text">{p.point.adresse || "Point de collecte"} · {p.type_service}</Text>
          <Text className="mt-2 font-medium text-primary-text">{MESSAGES[p.statut]}</Text>
          <Text className="text-xs text-secondary-text">Éboueur : {p.eboueur_nom}{p.heure_arrivee ? ` · arrivé à ${new Date(p.heure_arrivee).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : ""}</Text>
        </Carte>
      )}
    />
  );
}
