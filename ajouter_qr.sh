#!/usr/bin/env bash
set -euo pipefail

# Vérification de la présence du dossier web-frontend
if [ ! -d "web-frontend" ]; then
  echo "❌ Erreur : Le dossier 'web-frontend' est introuvable."
  echo "Veuillez lancer ce script depuis la racine de votre projet (là où se trouve 'web-frontend')."
  exit 1
fi

cd web-frontend

echo "📦 1. Installation de la librairie qrcode.react..."
npm install qrcode.react

echo "📝 2. Création du composant MonQRCode.jsx..."
mkdir -p src/pages
cat > src/pages/MonQRCode.jsx <<'__EOF__'
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "../auth";
import { Btn, Card } from "../ui";

export default function MonQRCode() {
  const { user } = useAuth();

  if (!user || user.role !== "CLIENT" || !user.qr_code_unique) {
    return (
      <Card>
        <p className="text-error font-bold">Erreur : QR Code introuvable. Vérifiez que vous êtes connecté en tant que client.</p>
      </Card>
    );
  }

  const telechargerQR = () => {
    const svg = document.getElementById("qr-client");
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `QR_Code_${user.nom.replace(/\s+/g, '_')}.png`;
      downloadLink.href = `${pngFile}`;
      downloadLink.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="space-y-6 max-w-lg mx-auto mt-8 animate-fade-in">
      <h2 className="section-title text-center">Mon QR Code de Collecte</h2>
      
      <Card className="flex flex-col items-center justify-center text-center space-y-6 py-10">
        <p className="text-secondary-text">
          Présentez ce code à l'éboueur lors de son passage pour valider la collecte de vos déchets.
        </p>

        <div className="bg-white p-4 rounded-2xl shadow-soft border border-defaut-border inline-block">
          <QRCodeSVG 
            id="qr-client"
            value={user.qr_code_unique} 
            size={256}
            level="H"
            includeMargin={true}
          />
        </div>

        <div className="bg-primary-50 text-primary-700 px-4 py-2 rounded-lg font-mono font-bold text-lg border border-primary-200">
          {user.qr_code_unique}
        </div>

        <Btn variante="contour" onClick={telechargerQR}>
          📥 Télécharger mon QR Code
        </Btn>
      </Card>
    </div>
  );
}
__EOF__

echo "🔧 3. Modification de Layout.jsx (ajout du menu)..."
# Utilisation de Node.js pour faire un remplacement sécurisé dans le fichier
node -e "
  const fs = require('fs');
  const path = 'src/Layout.jsx';
  if (fs.existsSync(path)) {
    let content = fs.readFileSync(path, 'utf8');
    // On cherche la liste des liens du client et on ajoute le nôtre
    if (!content.includes('Mon QR Code')) {
      content = content.replace(
        /\[\"\", \"♻️\", \"Mes abonnements\"\],/,
        '[\"\", \"♻️\", \"Mes abonnements\"], [\"/qr\", \"🔲\", \"Mon QR Code\"],'
      );
      fs.writeFileSync(path, content);
      console.log('✅ Lien ajouté dans la sidebar.');
    } else {
      console.log('ℹ️ Le lien existe déjà dans la sidebar.');
    }
  } else {
    console.log('⚠️ Fichier Layout.jsx introuvable, veuillez ajouter le lien manuellement.');
  }
"

echo "🔧 4. Modification de App.jsx (ajout de la route)..."
node -e "
  const fs = require('fs');
  const path = 'src/App.jsx';
  if (fs.existsSync(path)) {
    let content = fs.readFileSync(path, 'utf8');
    if (!content.includes('MonQRCode')) {
      // 1. Ajouter l'import
      content = content.replace(
        /import Layout from/,
        'import MonQRCode from \"./pages/MonQRCode\";\nimport Layout from'
      );
      // 2. Ajouter la route à l'intérieur du Layout client
      content = content.replace(
        /<Route path=\"\/client\" element=\{<Layout \/>\}>/,
        '<Route path=\"/client\" element={<Layout />}>\n          <Route path=\"qr\" element={<MonQRCode />} />'
      );
      fs.writeFileSync(path, content);
      console.log('✅ Route ajoutée dans App.jsx.');
    } else {
      console.log('ℹ️ La route existe déjà dans App.jsx.');
    }
  } else {
    console.log('⚠️ Fichier App.jsx introuvable, veuillez ajouter la route manuellement.');
  }
"

echo "✅ Terminé ! Vous pouvez relancer votre serveur web (npm run dev)."
echo "Connectez-vous avec un compte client, l'onglet 'Mon QR Code' est maintenant disponible."
