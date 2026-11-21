import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as Location from "expo-location";
import { useState } from "react";
import { Alert, Image, ScrollView, Text, TextInput } from "react-native";
import { api } from "../api";
import { Bouton } from "../ui";

export default function SignalerScreen() {
  const [photo, setPhoto] = useState(null);
  const [description, setDescription] = useState("");
  const [pos, setPos] = useState(null);
  const [busy, setBusy] = useState(false);

  const prendrePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert("Caméra refusée");

    // 1. On prend la photo SANS demander le base64 (pour ne pas saturer la mémoire)
    const r = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (r.canceled) return;

    try {
      // 2. On redimensionne et on compresse l'image avant de la convertir
      const manipResult = await ImageManipulator.manipulateAsync(
        r.assets[0].uri,
        [{ resize: { width: 800 } }], // Réduit la largeur à 800px maximum
        { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      
      // 3. On stocke la version légère
      setPhoto(`data:image/jpeg;base64,${manipResult.base64}`);
    } catch (error) {
      Alert.alert("Erreur", "Impossible de traiter la photo.");
    }
  };

  const localiser = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return Alert.alert("Localisation refusée");
    
    try {
      // Utiliser une précision moyenne est plus rapide et suffisant pour une collecte
      const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setPos({ latitude: p.coords.latitude, longitude: p.coords.longitude });
    } catch (e) {
      Alert.alert("Erreur GPS", "Impossible de récupérer votre position. Vérifiez que le GPS est activé.");
    }
  };

  const envoyer = async () => {
    if (!pos) return Alert.alert("Position requise", "Confirmez votre position GPS.");
    setBusy(true);
    try {
      await api("/signalements/", { method: "POST", body: { ...pos, description, photo_url: photo || "" } });
      Alert.alert("Merci !", "Votre signalement a été transmis à l'administration.");
      setPhoto(null); setDescription(""); setPos(null);
    } catch (e) { 
      Alert.alert("Erreur", e.message); 
    } finally { 
      setBusy(false); 
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }} className="bg-background-primary">
      <Text className="text-xl font-bold text-primary-text mb-3">Signaler un dépôt sauvage</Text>
      
      {photo && <Image source={{ uri: photo }} className="w-full h-56 rounded-xl mb-3" resizeMode="cover" />}
      
      <Bouton titre={photo ? "📷 Reprendre la photo" : "📷 Prendre une photo"} variante="gris" onPress={prendrePhoto} className="mb-3" />
      
      <Bouton titre={pos ? "📍 Position enregistrée" : "📍 Confirmer ma position GPS"} variante={pos ? "vert" : "gris"} onPress={localiser} className="mb-1" />
      
      {pos && <Text className="text-xs text-secondary-text mb-3 text-center">{pos.latitude.toFixed(5)}, {pos.longitude.toFixed(5)}</Text>}
      
      <TextInput 
        placeholder="Description / volume estimé" 
        placeholderTextColor="#a8bfb0" 
        multiline 
        value={description} 
        onChangeText={setDescription}
        className="bg-white border border-defaut-border rounded-xl p-3 h-24 my-3 text-primary-text" 
        textAlignVertical="top" 
      />
      
      <Bouton titre={busy ? "Envoi…" : "Signaler un dépôt sauvage"} variante="rouge" onPress={envoyer} disabled={busy} />
    </ScrollView>
  );
}