import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { Carte, Pastille } from "../ui";

export default function CatalogueScreen() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [rafraichit, setRafraichit] = useState(false);
  const charger = useCallback(async () => {
    setRafraichit(true);
    try { setItems((await api("/services/")).items); } catch {} finally { setRafraichit(false); }
  }, []);
  useEffect(() => { charger(); }, [charger]);

  return (
    <FlatList
      className="bg-background-primary"
      data={items} keyExtractor={(i) => i.id} contentContainerStyle={{ padding: 12 }}
      refreshControl={<RefreshControl refreshing={rafraichit} onRefresh={charger} />}
      ListHeaderComponent={<Text className="text-secondary-text mb-3">Souscrivez depuis le portail web (paiement, choix des 2 jours ouvrables).</Text>}
      renderItem={({ item: s }) => (
        <Carte>
          <View className="flex-row justify-between items-center">
            <Text className="text-xl font-bold text-primary-text">{s.type}</Text>
            {user.est_nouveau && <Pastille texte="🎁 2 mois gratuits" couleur="bg-primary-100 text-primary-700" />}
          </View>
          <Text className="text-3xl font-bold text-primary-500 my-2">{s.tarif_mensuel.toLocaleString("fr-FR")} <Text className="text-sm font-normal text-secondary-text">FCFA/mois</Text></Text>
          <Text className="text-secondary-text">Jusqu'à {s.poids_max_kg} kg · taille {s.taille_max} · priorité {s.priorite}</Text>
        </Carte>
      )}
    />
  );
}
