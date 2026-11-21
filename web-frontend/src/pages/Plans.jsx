import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Btn, Card, Field, couleurStatut, inputCls, useToast } from "../ui";

const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi"];

export default function Plans() {
  const { user, rafraichir } = useAuth();
  const notifier = useToast();
  const [services, setServices] = useState([]);
  const [subs, setSubs] = useState([]);
  const [points, setPoints] = useState([]);
  const [choix, setChoix] = useState(null);
  const [form, setForm] = useState({ poids_estime: 20, taille: "MOYEN", jours_choisis: [], duree_mois: 3, renouvellement_auto: false, mode_paiement: "MOBILE_MONEY" });
  const [simu, setSimu] = useState(null);
  const [pt, setPt] = useState({ adresse: "", zone: "", latitude: "", longitude: "", poids_estime: 20, taille: "MOYEN" });

  const charger = () => {
    api("/services/").then((d) => setServices(d.items));
    api("/souscriptions/").then((d) => setSubs(d.items));
    api("/points/").then((d) => setPoints(d.items));
  };
  useEffect(() => { charger(); }, []);

  useEffect(() => {
    if (!choix) return;
    api("/souscriptions/simuler/", { method: "POST", body: { service: choix.id, poids_estime: form.poids_estime, taille: form.taille, duree_mois: form.duree_mois } })
      .then(setSimu).catch(() => setSimu(null));
  }, [choix, form.poids_estime, form.taille, form.duree_mois]);

  const basculerJour = (j) => {
    let jours = form.jours_choisis.includes(j) ? form.jours_choisis.filter((x) => x !== j) : [...form.jours_choisis, j];
    if (jours.length > 2) jours = jours.slice(1);
    setForm({ ...form, jours_choisis: jours });
  };

  const souscrire = async (e) => {
    e.preventDefault();
    try {
      const r = await api("/souscriptions/", { method: "POST", body: { ...form, service: choix.id } });
      notifier(`Abonnement ${r.recu.service} activé — reçu ${r.recu.reference} (${r.recu.montant.toLocaleString("fr-FR")} FCFA).`);
      setChoix(null);
      charger();
      rafraichir();
    } catch (ex) { notifier(ex.message, "error"); charger(); }
  };

  const reessayer = async (id) => {
    try { await api(`/souscriptions/${id}/payer/`, { method: "POST", body: {} }); notifier("Paiement réussi, abonnement activé."); charger(); }
    catch (ex) { notifier(ex.message, "error"); }
  };

  const ajouterPoint = async (e) => {
    e.preventDefault();
    try { await api("/points/", { method: "POST", body: pt }); notifier("Point de collecte ajouté"); setPt({ ...pt, adresse: "", latitude: "", longitude: "" }); charger(); }
    catch (ex) { notifier(ex.message, "error"); }
  };

  const maPosition = () =>
    navigator.geolocation?.getCurrentPosition((p) => setPt({ ...pt, latitude: p.coords.latitude.toFixed(6), longitude: p.coords.longitude.toFixed(6) }));

  return (
    <div className="space-y-6">
      <h2 className="section-title">Mes abonnements</h2>

      <div className="grid gap-4 md:grid-cols-3">
        {services.map((s) => (
          <div key={s.id} className="stat-card flex flex-col">
            <div className="flex items-start justify-between">
              <h3 className="font-pally-bold text-lg text-primary-text">{s.type}</h3>
              {user.est_nouveau && <Badge couleur="vert">🎁 2 mois gratuits</Badge>}
            </div>
            <p className="font-pally-bold my-2 text-3xl text-primary">{s.tarif_mensuel.toLocaleString("fr-FR")} <span className="text-sm font-normal text-secondary-text">FCFA/mois</span></p>
            <p className="cell-muted flex-1">Jusqu'à {s.poids_max_kg} kg · taille {s.taille_max} · priorité {s.priorite}</p>
            <Btn className="mt-4" onClick={() => { setChoix(s); setForm({ ...form, jours_choisis: [] }); }}>Souscrire</Btn>
          </div>
        ))}
      </div>

      {choix && (
        <Card>
          <h3 className="font-pally-bold mb-4 text-xl">Souscrire au plan {choix.type}</h3>
          <form onSubmit={souscrire} className="grid gap-4 md:grid-cols-2">
            <Field label="Poids estimé (kg)"><input className={inputCls} type="number" min="1" value={form.poids_estime} onChange={(e) => setForm({ ...form, poids_estime: e.target.value })} /></Field>
            <Field label="Taille des ordures">
              <select className={inputCls} value={form.taille} onChange={(e) => setForm({ ...form, taille: e.target.value })}>
                <option value="PETIT">Petit</option><option value="MOYEN">Moyen</option><option value="GRAND">Grand</option>
              </select>
            </Field>
            <Field label="Durée (mois)"><input className={inputCls} type="number" min="1" max="24" value={form.duree_mois} onChange={(e) => setForm({ ...form, duree_mois: e.target.value })} /></Field>
            <Field label="Mode de paiement">
              <select className={inputCls} value={form.mode_paiement} onChange={(e) => setForm({ ...form, mode_paiement: e.target.value })}>
                <option value="MOBILE_MONEY">Mobile Money</option><option value="CARTE">Carte bancaire</option>
              </select>
            </Field>
            <Field className="md:col-span-2" label={choix.type === "EXPRESS" ? "Jours ouvrables (optionnel, 2 max)" : "Choisissez 2 jours ouvrables"}>
              <div className="flex flex-wrap gap-2">
                {JOURS.map((j) => (
                  <button type="button" key={j} onClick={() => basculerJour(j)}
                    className={`rounded-xl border px-4 py-2 text-sm font-semibold capitalize transition-all ${form.jours_choisis.includes(j) ? "border-primary bg-primary text-white" : "border-defaut-border bg-white text-primary-text"}`}>{j}</button>
                ))}
              </div>
            </Field>
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input type="checkbox" className="size-5 accent-primary" checked={form.renouvellement_auto} onChange={(e) => setForm({ ...form, renouvellement_auto: e.target.checked })} /> Renouvellement automatique
            </label>
            {simu && (
              <p className="rounded-xl bg-background-surface p-3 text-sm md:col-span-2">
                Tarif mensuel : <b>{simu.tarif_mensuel.toLocaleString("fr-FR")} FCFA</b> · Total sur {simu.mois} mois : <b>{simu.montant_total.toLocaleString("fr-FR")} FCFA</b>{" "}
                {simu.gratuit && <Badge couleur="vert">2 mois gratuits appliqués</Badge>}
              </p>
            )}
            <div className="flex justify-end gap-2 md:col-span-2">
              <Btn type="button" variante="gris" onClick={() => setChoix(null)}>Annuler</Btn>
              <Btn type="submit">{simu && simu.montant_total === 0 ? "Activer gratuitement" : "Payer et activer"}</Btn>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <h3 className="font-pally-bold mb-3 text-xl">Mes points de collecte</h3>
        <ul className="cell-muted mb-4 space-y-1">
          {points.map((p) => <li key={p.id}>📍 {p.adresse || "—"} · zone {p.zone} · {p.latitude.toFixed(4)}, {p.longitude.toFixed(4)}</li>)}
          {!points.length && <li className="text-secondary-700">Aucun point : ajoutez-en un avant de souscrire.</li>}
        </ul>
        <form onSubmit={ajouterPoint} className="grid items-end gap-2 md:grid-cols-5">
          <input className={inputCls} placeholder="Adresse" value={pt.adresse} onChange={(e) => setPt({ ...pt, adresse: e.target.value })} />
          <input className={inputCls} placeholder="Zone" value={pt.zone} onChange={(e) => setPt({ ...pt, zone: e.target.value })} />
          <input className={inputCls} placeholder="Latitude" required value={pt.latitude} onChange={(e) => setPt({ ...pt, latitude: e.target.value })} />
          <input className={inputCls} placeholder="Longitude" required value={pt.longitude} onChange={(e) => setPt({ ...pt, longitude: e.target.value })} />
          <div className="flex gap-2"><Btn type="button" variante="gris" onClick={maPosition}>📡</Btn><Btn type="submit">Ajouter</Btn></div>
        </form>
      </Card>

      <Card>
        <h3 className="font-pally-bold mb-3 text-xl">Historique des souscriptions</h3>
        <div className="space-y-2">
          {subs.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-defaut-border p-3 text-sm">
              <b>{s.service_type}</b>
              <Badge couleur={couleurStatut(s.statut)}>{s.statut}</Badge>
              <span className="text-secondary-text">{s.date_debut} → {s.date_fin}</span>
              <span className="capitalize text-secondary-text">{s.jours_choisis.join(", ") || "à la demande"}</span>
              {s.statut === "EN_ATTENTE" && <Btn className="ml-auto" onClick={() => reessayer(s.id)}>Réessayer le paiement</Btn>}
            </div>
          ))}
          {!subs.length && <p className="text-secondary-text">Aucune souscription</p>}
        </div>
      </Card>
    </div>
  );
}
