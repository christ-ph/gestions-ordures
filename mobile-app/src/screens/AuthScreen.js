import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../AuthContext";
import { Bouton } from "../ui";

const Champ = (props) => (
  <TextInput placeholderTextColor="#a8bfb0" autoCapitalize="none"
    className="bg-white border border-defaut-border rounded-xl px-4 py-3 mb-3 text-primary-text" {...props} />
);

export default function AuthScreen() {
  const { login, inscrire, verifier, renvoyer } = useAuth();
  const [mode, setMode] = useState("login"); // login | register | otp
  const [f, setF] = useState({ nom: "", email: "", telephone: "", adresse: "", password: "", code: "" });
  const [busy, setBusy] = useState(false);
  const maj = (k) => (v) => setF((o) => ({ ...o, [k]: v }));

  const soumettre = async () => {
    setBusy(true);
    try {
      if (mode === "login") {
        try { await login(f.email.trim(), f.password); }
        catch (e) {
          if (e.data?.non_verifie) { setMode("otp"); Alert.alert("Compte non vérifié", "Demandez un nouveau code si besoin."); }
          else throw e;
        }
      } else if (mode === "register") {
        await inscrire({ ...f, email: f.email.trim() });
        setMode("otp");
      } else {
        await verifier(f.email.trim(), f.code);
      }
    } catch (e) { Alert.alert("Erreur", e.message); } finally { setBusy(false); }
  };

  return (
    <SafeAreaView className="flex-1 bg-background-primary">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <ScrollView contentContainerStyle={{ padding: 24, flexGrow: 1, justifyContent: "center" }} keyboardShouldPersistTaps="handled">
          <Text className="text-3xl font-bold text-primary-500 text-center mb-1">♻️ Gestion Ordures</Text>
          <Text className="text-center text-secondary-text mb-6">{mode === "login" ? "Connexion" : mode === "register" ? "Créer un compte client" : "Vérification par email"}</Text>

          {mode !== "otp" ? (
            <>
              {mode === "register" && (<><Champ placeholder="Nom complet" value={f.nom} onChangeText={maj("nom")} autoCapitalize="words" />
                <Champ placeholder="Téléphone" keyboardType="phone-pad" value={f.telephone} onChangeText={maj("telephone")} />
                <Champ placeholder="Adresse" value={f.adresse} onChangeText={maj("adresse")} /></>)}
              <Champ placeholder="Email" keyboardType="email-address" value={f.email} onChangeText={maj("email")} />
              <Champ placeholder="Mot de passe" secureTextEntry value={f.password} onChangeText={maj("password")} />
            </>
          ) : (
            <>
              <Text className="text-secondary-text text-center mb-3">Saisissez le code à 6 chiffres reçu par email.</Text>
              <Champ placeholder="Email" keyboardType="email-address" value={f.email} onChangeText={maj("email")} />
              <Champ placeholder="000000" keyboardType="number-pad" maxLength={6} value={f.code} onChangeText={maj("code")} style={{ textAlign: "center", fontSize: 24, letterSpacing: 8 }} />
              <TouchableOpacity onPress={() => renvoyer(f.email.trim()).then(() => Alert.alert("Code renvoyé"))}>
                <Text className="text-primary-500 underline text-center mb-3">Renvoyer le code</Text>
              </TouchableOpacity>
            </>
          )}

          <Bouton titre={busy ? "…" : mode === "login" ? "Se connecter" : mode === "register" ? "S'inscrire" : "Vérifier"} onPress={soumettre} disabled={busy} />
          <View className="mt-4">
            {mode === "login" ? (
              <TouchableOpacity onPress={() => setMode("register")}><Text className="text-primary-500 text-center">Pas de compte ? S'inscrire</Text></TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => setMode("login")}><Text className="text-primary-500 text-center">Retour à la connexion</Text></TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
