import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Btn, Field, inputCls, useToast } from "../ui";

export default function Login() {
  const { ouvrirSession } = useAuth();
  const notifier = useToast();
  const nav = useNavigate();
  const [f, setF] = useState({ email: "", password: "" });

  const soumettre = async (e) => {
    e.preventDefault();
    try {
      ouvrirSession(await api("/auth/login/", { method: "POST", body: f, auth: false }));
      nav("/");
    } catch (ex) {
      if (ex.data?.non_verifie) nav(`/register?otp=${encodeURIComponent(f.email)}`);
      else notifier(ex.message, "error");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={soumettre} className="contact-form w-full max-w-sm">
        <div className="text-center">
          <p className="text-4xl">♻️</p>
          <h1 className="section-title mt-1">Gestion des Ordures</h1>
          <p className="eyebrow mt-1">Connexion</p>
        </div>
        <Field label="Email"><input className={inputCls} type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Mot de passe"><input className={inputCls} type="password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        <Btn type="submit" className="w-full">Se connecter</Btn>
        <p className="text-center text-sm text-secondary-text">Pas de compte ? <Link className="font-bold text-primary underline" to="/register">S'inscrire</Link></p>
      </form>
    </div>
  );
}
