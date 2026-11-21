import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, Text, TouchableOpacity, View } from "react-native";
import { api } from "../api";
import { Bouton } from "../ui";

export default function NotificationsScreen() {
  const [items, setItems] = useState([]);
  const [rafraichit, setRafraichit] = useState(false);
  const charger = useCallback(async () => {
    try { setItems((await api("/notifications/")).items); } catch {}
  }, []);
  useEffect(() => { charger(); const t = setInterval(charger, 15000); return () => clearInterval(t); }, [charger]);

  const lire = async (n) => { if (!n.est_lue) { await api(`/notifications/${n.id}/lire/`, { method: "POST" }); charger(); } };
  const toutLire = async () => { await api("/notifications/lire-tout/", { method: "POST" }); charger(); };

  return (
    <FlatList
      className="bg-background-primary"
      data={items} keyExtractor={(i) => i.id} contentContainerStyle={{ padding: 12 }}
      refreshControl={<RefreshControl refreshing={rafraichit} onRefresh={async () => { setRafraichit(true); await charger(); setRafraichit(false); }} />}
      ListHeaderComponent={<Bouton titre="Tout marquer comme lu" variante="gris" onPress={toutLire} className="mb-3" />}
      ListEmptyComponent={<Text className="text-center text-secondary-text mt-10">Aucune notification</Text>}
      renderItem={({ item: n }) => (
        <TouchableOpacity onPress={() => lire(n)}>
          <View className={`rounded-xl p-3 mb-2 border ${n.est_lue ? "bg-white border-defaut-border" : n.type === "ARRIVEE_EBOUEUR" ? "bg-secondary-50 border-secondary-400" : "bg-primary-50 border-primary-200"}`}>
            <Text className="font-bold text-primary-text">{n.titre}</Text>
            <Text className="text-secondary-text">{n.message}</Text>
            <Text className="text-xs text-disabled-text mt-1">{new Date(n.date_envoi).toLocaleString("fr-FR")}</Text>
          </View>
        </TouchableOpacity>
      )}
    />
  );
}
