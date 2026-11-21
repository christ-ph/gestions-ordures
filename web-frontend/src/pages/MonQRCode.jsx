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
