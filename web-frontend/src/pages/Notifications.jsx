import { useEffect, useState } from "react";
import { api } from "../api";
import { Badge, Btn } from "../ui";

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [nonLues, setNonLues] = useState(0);
  const charger = () => api("/notifications/").then((d) => { setItems(d.items); setNonLues(d.non_lues); });
  useEffect(() => { charger(); const t = setInterval(charger, 15000); return () => clearInterval(t); }, []);

  const lire = async (n) => { if (!n.est_lue) { await api(`/notifications/${n.id}/lire/`, { method: "POST" }); charger(); } };
  const toutLire = async () => { await api("/notifications/lire-tout/", { method: "POST" }); charger(); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="section-title">Notifications {nonLues > 0 && <Badge couleur="rouge">{nonLues} non lue(s)</Badge>}</h2>
        <Btn variante="gris" onClick={toutLire} disabled={!nonLues}>Tout marquer comme lu</Btn>
      </div>
      {items.map((n) => (
        <div key={n.id} onClick={() => lire(n)}
          className={`cursor-pointer rounded-2xl border p-4 shadow-card ${n.est_lue ? "border-white bg-white" : n.type === "ARRIVEE_EBOUEUR" ? "border-secondary bg-secondary-50" : "border-primary-200 bg-primary-50"}`}>
          <div className="flex justify-between"><p className="cell-strong">{n.titre}</p><span className="cell-subtitle">{new Date(n.date_envoi).toLocaleString("fr-FR")}</span></div>
          <p className="cell-muted">{n.message}</p>
        </div>
      ))}
      {!items.length && <p className="py-10 text-center text-secondary-text">Aucune notification</p>}
    </div>
  );
}
