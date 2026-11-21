import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useEffect, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { api } from "./api";
import { useAuth } from "./AuthContext";
import { Chargement } from "./ui";
import AuthScreen from "./screens/AuthScreen";
import CatalogueScreen from "./screens/CatalogueScreen";
import NotificationsScreen from "./screens/NotificationsScreen";
import QRScreen from "./screens/QRScreen";
import SignalerScreen from "./screens/SignalerScreen";
import SuiviScreen from "./screens/SuiviScreen";
import TourneeScreen from "./screens/TourneeScreen";

const Tab = createBottomTabNavigator();

function useNonLues() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const charger = () => api("/notifications/").then((d) => setN(d.non_lues)).catch(() => {});
    charger();
    const t = setInterval(charger, 15000);
    return () => clearInterval(t);
  }, []);
  return n;
}

const icone = (e) => () => <Text style={{ fontSize: 18 }}>{e}</Text>;

function Onglets({ ecrans }) {
  const { logout } = useAuth();
  const nonLues = useNonLues();
  return (
    <Tab.Navigator screenOptions={{
      headerStyle: { backgroundColor: "#224d33" }, headerTintColor: "#fff", tabBarActiveTintColor: "#2f6b47",
      headerRight: () => (
        <TouchableOpacity onPress={logout} style={{ marginRight: 14 }}><Text style={{ color: "#fff" }}>Déconnexion</Text></TouchableOpacity>
      ),
    }}>
      {ecrans.map(([name, component, emoji, titre]) => (
        <Tab.Screen key={name} name={name} component={component}
          options={{ title: titre, tabBarIcon: icone(emoji), tabBarBadge: name === "Notifications" && nonLues > 0 ? nonLues : undefined }} />
      ))}
    </Tab.Navigator>
  );
}

const CLIENT = [
  ["Offres", CatalogueScreen, "🛒", "Offres"], ["Suivi", SuiviScreen, "🚛", "Suivi"], ["QR", QRScreen, "🔳", "Mon QR"],
  ["Signaler", SignalerScreen, "⚠️", "Signaler"], ["Notifications", NotificationsScreen, "🔔", "Notifications"],
];
const EBOUEUR = [["Tournee", TourneeScreen, "🗺️", "Ma tournée"], ["Notifications", NotificationsScreen, "🔔", "Notifications"]];

export default function Navigation() {
  const { user, chargement, logout } = useAuth();
  if (chargement) return <Chargement />;
  if (!user) return <AuthScreen />;
  if (user.role === "CLIENT") return <Onglets ecrans={CLIENT} />;
  if (user.role === "EBOUEUR") return <Onglets ecrans={EBOUEUR} />;
  return (
    <View className="flex-1 items-center justify-center bg-background-primary p-8">
      <Text className="text-center text-secondary-text mb-4">Le rôle Admin utilise le portail web.</Text>
      <TouchableOpacity onPress={logout}><Text className="text-primary-500 underline">Déconnexion</Text></TouchableOpacity>
    </View>
  );
}
