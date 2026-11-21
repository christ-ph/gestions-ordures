import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { api } from "./api";
import { useAuth } from "./auth";

export default function Layout() {
  const { user, deconnexion } = useAuth();
  const [nonLues, setNonLues] = useState(0);
  const [reduit, setReduit] = useState(false);
  const [ouvert, setOuvert] = useState(false);

  useEffect(() => {
    const charger = () => api("/notifications/").then((d) => setNonLues(d.non_lues)).catch(() => {});
    charger();
    const t = setInterval(charger, 15000);
    return () => clearInterval(t);
  }, []);

  const base = user.role === "ADMIN" ? "/admin" : "/client";
  const liens = user.role === "ADMIN"
    ? [["", "📊", "Dashboard"], ["/users", "👥", "Utilisateurs"], ["/services", "💰", "Services & tarifs"],
       ["/points", "📍", "Points de collecte"], ["/signalements", "⚠️", "Signalements"], ["/logs", "🛡️", "Monitoring"],
       ["/notifications", "🔔", "Notifications"]]
    : [["", "♻️", "Mes abonnements"], ["/qr", "🔲", "Mon QR Code"], ["/notifications", "🔔", "Notifications"]];

  return (
    <div className="flex min-h-screen bg-background-primary text-primary-text">
      <aside className={`${reduit ? "w-20" : "w-64"} ${ouvert ? "translate-x-0" : ""} sticky top-0 flex h-screen shrink-0 flex-col border-r border-defaut-border bg-background-surface transition-all duration-200`}>
        <div className="sidebar-header">
          <div className="mb-6 flex items-center gap-2">
            <span className="text-2xl">♻️</span>
            <span className="sidebar-text font-pally-bold text-lg text-primary">Gestion Ordures</span>
          </div>
        </div>
        <nav className="sidebar-nav">
          <div className="space-y-2 flex flex-col">
            {liens.map(([to, ico, label]) => (
              <NavLink key={to} to={base + to} end={to === ""} onClick={() => setOuvert(false)}
                className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}>
                <i className="not-italic">{ico}</i>
                <span className="sidebar-text flex-1">{label}</span>
                {to === "/notifications" && nonLues > 0 && (
                  <span className="new-badge rounded-full bg-error px-2 text-xs font-bold text-white">{nonLues}</span>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
        <div className="sidebar-footer">
          <div>
            <p className="sidebar-text cell-subtitle mb-2">{user.nom} · {user.role}</p>
            <button onClick={deconnexion} className="sidebar-link w-full">
              <i className="not-italic">🚪</i><span className="sidebar-text">Déconnexion</span>
            </button>
          </div>
        </div>
      </aside>

      {ouvert && <div className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={() => setOuvert(false)} />}

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="glass-panel sticky top-0 z-30 flex items-center gap-3 px-4 py-3">
          <button className="text-xl md:hidden" onClick={() => { setReduit(false); setOuvert(true); }} aria-label="Menu">☰</button>
          <button className="hidden text-xl md:block" onClick={() => setReduit(!reduit)} aria-label="Réduire le menu">☰</button>
          <span className="font-pally-bold text-primary-text">{user.role === "ADMIN" ? "Espace Administrateur" : "Espace Client"}</span>
        </header>
        <div className="content-scroll flex-1 overflow-y-auto p-6"><Outlet /></div>
      </main>
    </div>
  );
}
