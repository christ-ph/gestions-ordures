import { useEffect, useState } from "react";
import { api } from "../api";
import { Badge, Btn, couleurStatut, useToast } from "../ui";

export default function Signalements() {
  const notifier = useToast();
  const [items, setItems] = useState([]);
  const charger = () => api("/signalements/").then((d) => setItems(d.items));
  useEffect(() => { charger(); }, []);

  const agir = async (id, action) => {
    try {
      await api(`/signalements/${id}/${action}/`, { method: "POST" });
      notifier(action === "convertir" ? "Converti en collecte Express" : "Signalement traité");
      charger();
    } catch (e) { notifier(e.message, "error"); }
  };

  return (
    <div className="space-y-4">
      <h2 className="section-title">Signalements citoyens</h2>
      {items.map((s) => (
        <div key={s.id} className="flex gap-4 rounded-2xl bg-white p-4 shadow-card">
          {s.photo_url
            ? <img src={s.photo_url} alt="dépôt" className="size-24 rounded-xl object-cover" />
            : <div className="flex size-24 items-center justify-center rounded-xl bg-background-primary text-xs text-secondary-text">sans photo</div>}
          <div className="flex-1">
            <p className="cell-strong">{s.client_nom} <Badge couleur={couleurStatut(s.statut)}>{s.statut}</Badge></p>
            <p className="cell-muted">{s.description || "Aucune description"}</p>
            <a className="text-xs font-bold text-primary underline" target="_blank" rel="noreferrer"
              href={`https://www.openstreetmap.org/?mlat=${s.latitude}&mlon=${s.longitude}#map=17/${s.latitude}/${s.longitude}`}>
              {s.latitude.toFixed(5)}, {s.longitude.toFixed(5)}
            </a>
            <p className="cell-subtitle">{new Date(s.date_creation).toLocaleString("fr-FR")}</p>
          </div>
          {s.statut === "OUVERT" && (
            <div className="flex flex-col gap-2">
              <Btn onClick={() => agir(s.id, "convertir")}>Convertir en Express</Btn>
              <Btn variante="gris" onClick={() => agir(s.id, "traiter")}>Marquer traité</Btn>
            </div>
          )}
        </div>
      ))}
      {!items.length && <p className="py-10 text-center text-secondary-text">Aucun signalement</p>}
    </div>
  );
}
