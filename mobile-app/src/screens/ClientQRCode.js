import React from "react";
import { View, Text, StyleSheet } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useAuth } from "../auth"; // Assurez-vous d'avoir un contexte d'auth comme sur le web

export default function ClientQRCode() {
  const { user } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mon QR Code</Text>
      <Text style={styles.subtitle}>Présentez ce code à l'éboueur lors de son passage.</Text>
      
      <View style={styles.qrContainer}>
        {user && user.qr_code_unique ? (
          <QRCode
            value={user.qr_code_unique}
            size={250}
            color="black"
            backgroundColor="white"
          />
        ) : (
          <Text style={{ color: "red" }}>QR Code introuvable</Text>
        )}
      </View>

      {user && user.qr_code_unique && (
        <Text style={styles.codeText}>{user.qr_code_unique}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f5efe0", // Votre couleur de fond
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1a3c2a", // Couleur primaire
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: "#6b8c76",
    textAlign: "center",
    marginBottom: 30,
  },
  qrContainer: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5, // Pour Android
  },
  codeText: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "monospace",
    color: "#2f6b47",
  },
});