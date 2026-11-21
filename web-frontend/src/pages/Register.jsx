import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Btn, Field, inputCls, useToast } from "../ui";

export default function Register() {
  const { ouvrirSession } = useAuth();
  const notifier = useToast();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const emailOtp = params.get("otp");
  const [etape, setEtape] = useState(emailOtp ? "otp" : "form");
  const [f, setF] = useState({ nom: "", email: emailOtp || "", telephone: "", adresse: "", password: "" });
  const [code, setCode] = useState("");
  const maj = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const inscrire = async (e) => {
    e.preventDefault();
    try {
      await api("/auth/register/", { method: "POST", body: f, auth: false });
      notifier("Compte créé : un code OTP vous a été envoyé par email.");
      setEtape("otp");
    } catch (ex) { notifier(ex.message, "error"); }
  };

  const verifier = async (e) => {
    e.preventDefault();
    try {
      ouvrirSession(await api("/auth/verify-otp/", { method: "POST", body: { email: f.email, code }, auth: false }));
      nav("/");
    } catch (ex) { notifier(ex.message, "error"); }
  };

  const renvoyer = async () => {
    await api("/auth/resend-otp/", { method: "POST", body: { email: f.email }, auth: false });
    notifier("Un nouveau code a été envoyé.");
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      {etape === "form" ? (
        <form onSubmit={inscrire} className="contact-form w-full max-w-md">
          <h1 className="section-title text-center">Inscription client</h1>
          <Field label="Nom complet"><input className={inputCls} required value={f.nom} onChange={maj("nom")} /></Field>
          <Field label="Email"><input className={inputCls} type="email" required value={f.email} onChange={maj("email")} /></Field>
          <Field label="Téléphone"><input className={inputCls} value={f.telephone} onChange={maj("telephone")} /></Field>
          <Field label="Adresse"><input className={inputCls} value={f.adresse} onChange={maj("adresse")} /></Field>
          <Field label="Mot de passe (8 caractères min.)"><input className={inputCls} type="password" minLength={8} required value={f.password} onChange={maj("password")} /></Field>
          <Btn type="submit" className="w-full">Créer mon compte</Btn>
          <p className="text-center text-sm"><Link className="font-bold text-primary underline" to="/login">Déjà inscrit ? Connexion</Link></p>
        </form>
      ) : (
        <form onSubmit={verifier} className="contact-form w-full max-w-md">
          <h1 className="section-title text-center">Vérification</h1>
          <p className="text-sm text-secondary-text">Un code à 6 chiffres a été envoyé à <b>{f.email}</b>. Il est valable 10 minutes.</p>
          <input className={`${inputCls} text-center text-2xl tracking-[0.5em]`} inputMode="numeric" maxLength={6} placeholder="000000"
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          <Btn type="submit" className="w-full" disabled={code.length !== 6}>Vérifier</Btn>
          <button type="button" onClick={renvoyer} className="text-sm font-bold text-primary underline">Renvoyer le code</button>
        </form>
      )}
    </div>
  );
}
