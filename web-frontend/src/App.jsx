import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import CrudPage from "./CrudPage";
import MonQRCode from "./pages/MonQRCode";
import Layout from "./Layout";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Logs from "./pages/Logs";
import Notifications from "./pages/Notifications";
import Plans from "./pages/Plans";
import Register from "./pages/Register";
import Signalements from "./pages/Signalements";
import { Badge } from "./ui";

function Protege({ roles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function Accueil() {
  const { user, deconnexion } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "ADMIN") return <Navigate to="/admin" replace />;
  if (user.role === "CLIENT") return <Navigate to="/client" replace />;
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-card">
        <h1 className="section-title mb-2">Espace Éboueur</h1>
        <p className="mb-4 text-secondary-text">Les éboueurs utilisent l'application mobile (tournée, scan QR, mode hors-ligne).</p>
        <button onClick={deconnexion} className="btn-ghost">Déconnexion</button>
      </div>
    </div>
  );
}

const TAILLES = [{ value: "PETIT", label: "Petit" }, { value: "MOYEN", label: "Moyen" }, { value: "GRAND", label: "Grand" }];

const UsersPage = () => (
  <CrudPage titre="Utilisateurs" endpoint="/users/" vierge={{ role: "EBOUEUR", is_active: true }}
    colonnes={[{ k: "nom", label: "Nom" }, { k: "email", label: "Email" }, { k: "role", label: "Rôle" },
      { label: "Vérifié", render: (u) => <Badge couleur={u.is_verified ? "vert" : "jaune"}>{u.is_verified ? "oui" : "non"}</Badge> },
      { label: "Actif", render: (u) => <Badge couleur={u.is_active ? "vert" : "rouge"}>{u.is_active ? "actif" : "inactif"}</Badge> }]}
    champs={[
      { k: "nom", label: "Nom" },
      { k: "email", label: "Email", type: "email", creation: true },
      { k: "telephone", label: "Téléphone" },
      { k: "role", label: "Rôle", type: "select", creation: true,
        options: [{ value: "ADMIN", label: "Admin" }, { value: "CLIENT", label: "Client" }, { value: "EBOUEUR", label: "Éboueur" }] },
      { k: "password", label: "Mot de passe (vide = inchangé)", type: "password" },
      { k: "adresse", label: "Adresse (client)" },
      { k: "zone_affectee", label: "Zone affectée (éboueur)" },
      { k: "is_active", label: "Compte actif", type: "checkbox" },
    ]} />
);

const ServicesPage = () => (
  <CrudPage titre="Services & grille tarifaire" endpoint="/services/" vierge={{ type: "STANDARD", taille_max: "MOYEN" }}
    colonnes={[{ k: "type", label: "Type" }, { k: "poids_max_kg", label: "Poids max (kg)" },
      { k: "taille_max", label: "Taille max" }, { k: "tarif_mensuel", label: "Tarif mensuel (FCFA)" }]}
    champs={[
      { k: "type", label: "Type", type: "select", options: [{ value: "STANDARD", label: "Standard" }, { value: "EXPRESS", label: "Express" }, { value: "VIP", label: "VIP" }] },
      { k: "poids_max_kg", label: "Poids maximum (kg)", type: "number" },
      { k: "taille_max", label: "Taille maximum", type: "select", options: TAILLES },
      { k: "tarif_mensuel", label: "Tarif mensuel (FCFA)", type: "number" },
    ]} />
);

const PointsPage = () => (
  <CrudPage titre="Points de collecte" endpoint="/points/" vierge={{ taille: "MOYEN", poids_estime: 20, capacite_max: 100 }}
    colonnes={[{ k: "client_nom", label: "Client" }, { k: "adresse", label: "Adresse" }, { k: "zone", label: "Zone" },
      { label: "GPS", render: (p) => `${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}` },
      { k: "poids_estime", label: "Poids (kg)" }, { k: "taille", label: "Taille" }]}
    champs={[
      { k: "client", label: "Client", type: "select", creation: true, optionsDepuis: "/users/?role=CLIENT" },
      { k: "adresse", label: "Adresse" }, { k: "zone", label: "Zone" },
      { k: "latitude", label: "Latitude", type: "number" }, { k: "longitude", label: "Longitude", type: "number" },
      { k: "poids_estime", label: "Poids estimé (kg)", type: "number" },
      { k: "taille", label: "Taille", type: "select", options: TAILLES },
      { k: "capacite_max", label: "Capacité max (kg)", type: "number" },
    ]} />
);

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Accueil />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/admin" element={<Protege roles={["ADMIN"]}><Layout /></Protege>}>
        <Route index element={<Dashboard />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="services" element={<ServicesPage />} />
        <Route path="points" element={<PointsPage />} />
        <Route path="signalements" element={<Signalements />} />
        <Route path="logs" element={<Logs />} />
        <Route path="notifications" element={<Notifications />} />
      </Route>
      <Route path="/client" element={<Protege roles={["CLIENT"]}><Layout /></Protege>}>
        <Route index element={<Plans />} />
        <Route path="qr" element={<MonQRCode />} />  {/* LA LIGNE AJOUTÉE EST ICI */}
        <Route path="notifications" element={<Notifications />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
