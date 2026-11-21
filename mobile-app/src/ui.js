import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

export const Carte = ({ children, className = "" }) => (
  <View className={`bg-white rounded-2xl p-4 mb-3 shadow ${className}`}>{children}</View>
);

export const Bouton = ({ titre, onPress, variante = "vert", disabled, className = "" }) => {
  const couleurs = { vert: "bg-primary-500", gris: "bg-secondary-text", rouge: "bg-error", orange: "bg-secondary-500" };
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.8}
      className={`${couleurs[variante]} rounded-xl py-3 px-4 items-center ${disabled ? "opacity-50" : ""} ${className}`}>
      <Text className="text-white font-semibold">{titre}</Text>
    </TouchableOpacity>
  );
};

export const Pastille = ({ texte, couleur = "bg-background-surface text-secondary-text" }) => {
  const [bg, tx] = couleur.split(" ");
  return <View className={`${bg} rounded-full px-2 py-0.5 self-start`}><Text className={`${tx} text-xs font-bold`}>{texte}</Text></View>;
};

export const couleurStatut = (s) =>
  ({ EFFECTUE: "bg-primary-100 text-primary-700", SUR_PLACE: "bg-secondary-100 text-secondary-700",
     PLANIFIE: "bg-info/10 text-info", ECHEC: "bg-error/10 text-error" }[s] || "bg-background-surface text-secondary-text");

export const Chargement = () => (
  <View className="flex-1 items-center justify-center bg-background-primary"><ActivityIndicator size="large" color="#2f6b47" /></View>
);
