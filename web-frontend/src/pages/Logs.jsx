import { useEffect, useState } from "react";
import { api } from "../api";
import { Badge, Btn, Table } from "../ui";

export default function Logs() {
  const [items, setItems] = useState([]);
  const charger = () => api("/logs/").then((d) => setItems(d.items));
  useEffect(() => { charger(); }, []);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="section-title">Monitoring</h2>
        <Btn variante="gris" onClick={charger}>Actualiser</Btn>
      </div>
      <Table
        colonnes={[
          { label: "Date", render: (l) => new Date(l.timestamp).toLocaleString("fr-FR") },
          { k: "utilisateur", label: "Utilisateur" }, { k: "action", label: "Action" }, { k: "endpoint", label: "Endpoint" },
          { label: "HTTP", render: (l) => <Badge couleur={l.statut_http < 400 ? "vert" : l.statut_http < 500 ? "jaune" : "rouge"}>{l.statut_http}</Badge> },
        ]}
        lignes={items}
      />
    </div>
  );
}
