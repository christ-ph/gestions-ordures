import { useEffect, useState } from "react";
import { api } from "./api";
import { Btn, Card, Field, Modal, Table, inputCls, useToast } from "./ui";

export default function CrudPage({ titre, endpoint, colonnes, champs, vierge = {} }) {
  const notifier = useToast();
  const [items, setItems] = useState([]);
  const [edit, setEdit] = useState(null);
  const [opts, setOpts] = useState({});

  const charger = () => api(endpoint).then((d) => setItems(d.items)).catch((e) => notifier(e.message, "error"));

  useEffect(() => {
    charger();
    champs.filter((c) => c.optionsDepuis).forEach((c) =>
      api(c.optionsDepuis).then((d) =>
        setOpts((o) => ({ ...o, [c.k]: d.items.map((x) => ({ value: x.id, label: x.nom })) }))));
  }, []);

  const enregistrer = async (e) => {
    e.preventDefault();
    try {
      if (edit.id) await api(`${endpoint}${edit.id}/`, { method: "PUT", body: edit });
      else await api(endpoint, { method: "POST", body: edit });
      notifier(edit.id ? "Modification enregistrée" : "Élément créé");
      setEdit(null);
      charger();
    } catch (ex) { notifier(ex.message, "error"); }
  };

  const supprimer = async (it) => {
    if (!window.confirm("Supprimer cet élément ?")) return;
    try { await api(`${endpoint}${it.id}/`, { method: "DELETE" }); notifier("Élément supprimé"); charger(); }
    catch (ex) { notifier(ex.message, "error"); }
  };

  const maj = (k, v) => setEdit((o) => ({ ...o, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="section-title">{titre}</h2>
        <Btn onClick={() => setEdit({ ...vierge })}>+ Ajouter</Btn>
      </div>
      <Table
        colonnes={[...colonnes, { label: "Actions", render: (l) => (
          <div className="flex gap-1">
            <button className="table-action-btn" onClick={() => setEdit({ ...l })}>✏️ Modifier</button>
            <button className="table-action-btn hover:!text-error" onClick={() => supprimer(l)}>🗑️ Supprimer</button>
          </div>) }]}
        lignes={items}
      />
      {edit && (
        <Modal titre={edit.id ? "Modifier" : "Ajouter"} onClose={() => setEdit(null)}>
          <form onSubmit={enregistrer} className="flex flex-col gap-4">
            {champs.filter((c) => !c.creation || !edit.id).map((c) => (
              <Field key={c.k} label={c.label}>
                {c.type === "select" ? (
                  <select className={inputCls} value={edit[c.k] ?? ""} onChange={(e) => maj(c.k, e.target.value)} required={!edit.id}>
                    <option value="">— choisir —</option>
                    {(c.options || opts[c.k] || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : c.type === "checkbox" ? (
                  <input type="checkbox" className="size-5 accent-primary" checked={!!edit[c.k]} onChange={(e) => maj(c.k, e.target.checked)} />
                ) : (
                  <input className={inputCls} type={c.type || "text"} step="any" value={edit[c.k] ?? ""} onChange={(e) => maj(c.k, e.target.value)} />
                )}
              </Field>
            ))}
            <div className="flex justify-end gap-2">
              <Btn type="button" variante="gris" onClick={() => setEdit(null)}>Annuler</Btn>
              <Btn type="submit">Enregistrer</Btn>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
