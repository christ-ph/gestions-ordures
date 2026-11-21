import { useEffect, useState } from "react";
import { api } from "../api";
import { Badge, Btn, Table, couleurStatut, inputCls, useToast } from "../ui";

const Kpi = ({ label, valeur, ico }) => (
  <div className="stat-card">
    <p className="text-2xl">{ico}</p>
    <p className="cell-subtitle mt-2 uppercase tracking-wider">{label}</p>
    <p className="font-pally-bold mt-1 text-2xl text-primary">{valeur}</p>
  </div>
);

export default function Dashboard() {
  const notifier = useToast();
  const [k, setK] = useState(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [plan, setPlan] = useState([]);
  const [busy, setBusy] = useState(false);

  const charger = () => {
    api("/dashboard/").then(setK).catch(() => {});
    api(`/planning/?date=${date}`).then((d) => setPlan(d.items)).catch(() => {});
  };
  useEffect(() => { charger(); }, [date]);

  const generer = async () => {
    setBusy(true);
    try {
      const r = await api("/planning/generer/", { method: "POST", body: { date } });
      notifier(`${r.crees} collecte(s) planifiée(s) pour ${r.eboueurs} éboueur(s) — ${r.non_affectees} non affectée(s).`);
      charger();
    } catch (e) { notifier(e.message, "error"); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <h2 className="section-title">Tableau de bord</h2>
      {k && (
        <div className="animate-fade-in grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi ico="💰" label="Revenus" valeur={`${k.revenus.toLocaleString("fr-FR")} FCFA`} />
          <Kpi ico="⚖️" label="Tonnage collecté" valeur={`${k.tonnage_kg.toLocaleString("fr-FR")} kg`} />
          <Kpi ico="📄" label="Abonnements actifs" valeur={k.abonnements_actifs} />
          <Kpi ico="✅" label="Taux de collecte" valeur={`${k.taux_collecte} %`} />
        </div>
      )}
      <div className="table-card">
        <div className="table-toolbar">
          <div className="flex flex-wrap items-end gap-3">
            <div className="contact-field">
              <label className="input-label">Date de la tournée</label>
              <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <Btn onClick={generer} disabled={busy}>{busy ? "Calcul…" : "Générer le Planning (Job Scheduling + Graphe)"}</Btn>
          </div>
        </div>
        <Table
          colonnes={[
            { k: "eboueur_nom", label: "Éboueur" }, { k: "ordre_passage", label: "Ordre" },
            { label: "Adresse", render: (p) => p.point.adresse || "—" }, { label: "Zone", render: (p) => p.point.zone },
            { label: "Service", render: (p) => `${p.type_service} (P${p.priorite})` },
            { label: "Statut", render: (p) => <Badge couleur={couleurStatut(p.statut)}>{p.statut}</Badge> },
          ]}
          lignes={plan} vide="Aucune collecte planifiée pour cette date"
        />
      </div>
    </div>
  );
}
