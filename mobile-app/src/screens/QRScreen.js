import { Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useAuth } from "../AuthContext";

export default function QRScreen() {
  const { user } = useAuth();
  return (
    <View className="flex-1 items-center justify-center bg-white p-6">
      <Text className="text-xl font-bold text-primary-text mb-1">Mon QR Code</Text>
      <Text className="text-secondary-text text-center mb-6">Collez-le sur votre bac : l'éboueur le scanne pour valider la collecte.</Text>
      {user.qr_code_unique ? <QRCode value={user.qr_code_unique} size={240} color="#1a3c2a" /> : <Text>QR Code indisponible</Text>}
      <Text className="mt-4 text-primary-text">{user.qr_code_unique}</Text>
    </View>
  );
}
