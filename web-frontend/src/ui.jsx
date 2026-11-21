import { createContext, useCallback, useContext, useState } from "react";

/* ── Toasts (classes toast-* du design system) ── */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const retirer = (id) => setItems((l) => l.filter((t) => t.id !== id));
  const notifier = useCallback((texte, type = "success") => {
    const id = Date.now() + Math.random();
    setItems((l) => [...l, { id, texte, type }]);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={notifier}>
      {children}
      <div className="toast-stack">
        {items.map((t) => (
          <div key={t.id} role="status" className={`toast-message toast-message--${t.type}`}>
            <div className="toast-message__content">
              <span className="toast-message__indicator" />
              <p className="toast-message__text">{t.texte}</p>
            </div>
            <button className="toast-message__close" onClick={() => retirer(t.id)} aria-label="Fermer">×</button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ── Composants de base ── */
export const Card = ({ children, className = "" }) => (
  <div className={`rounded-2xl bg-white p-6 shadow-card ${className}`}>{children}</div>
);

const VARIANTES = {
  primaire: "btn-primary",
  contour: "btn-primary-outline",
  gris: "btn-ghost",
  danger: "inline-flex h-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-error bg-error px-6 text-sm font-medium text-white transition-all hover:opacity-90 disabled:pointer-events-none disabled:opacity-50",
};

export const Btn = ({ children, variante = "primaire", className = "", ...p }) => (
  <button className={`${VARIANTES[variante]} ${className}`} {...p}>{children}</button>
);

export const Field = ({ label, children, className = "" }) => (
  <div className={`contact-field ${className}`}>
    <label className="input-label">{label}</label>
    {children}
  </div>
);

export const inputCls = "input-control";

export const Badge = ({ children, couleur = "slate" }) => {
  const variantes = { vert: "status-badge--paid", jaune: "status-badge--pending", rouge: "status-badge--overdue" };
  const extra = variantes[couleur] ||
    (couleur === "bleu" ? "border-info/30 bg-info/10 text-info" : "border-defaut-border bg-background-surface text-secondary-text");
  const point = couleur === "bleu" ? "bg-info" : couleur === "slate" ? "bg-disabled-text" : "";
  return (
    <span className={`status-badge ${extra}`}>
      <span className={`status-dot ${point}`} />
      {children}
    </span>
  );
};

export const couleurStatut = (s) =>
  ({ EFFECTUE: "vert", ACTIVE: "vert", REUSSI: "vert", TRAITE: "vert", SUR_PLACE: "jaune", EN_ATTENTE: "jaune",
     OUVERT: "jaune", PLANIFIE: "bleu", CONVERTI_EXPRESS: "bleu", ECHEC: "rouge", EXPIREE: "rouge", ANNULEE: "rouge" }[s] || "slate");

export function Modal({ titre, onClose, children }) {
  return (
    <div className="modal modal-visible" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-dialog m-4 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-pally-bold text-xl text-primary-text">{titre}</h3>
          <button className="toast-message__close" onClick={onClose} aria-label="Fermer">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const Table = ({ colonnes, lignes, vide = "Aucune donnée" }) => (
  <div className="table-card">
    <div className="table-scroll-x">
      <table className="data-table">
        <thead>
          <tr>{colonnes.map((c) => <th key={c.label}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {lignes.map((l, i) => (
            <tr key={l.id || i} className="data-table-row">
              {colonnes.map((c) => (
                <td key={c.label} className="cell-muted">{c.render ? c.render(l) : String(l[c.k] ?? "—")}</td>
              ))}
            </tr>
          ))}
          {!lignes.length && (
            <tr><td colSpan={colonnes.length} className="cell-muted text-center">{vide}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);
