import json
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation
from functools import wraps

from django.db.models import ProtectedError, Sum
from django.http import JsonResponse
from django.utils import timezone

from . import services
from .auth import authentifie, creer_token, decoder_token, tokens_pour
from .models import (LogMonitoring, Notification, Paiement, PlanningCollecte, PointCollecte, ProfilClient,
                     Service, SignalementCitoyen, Souscription, User)
from .serializers import (s_log, s_notification, s_paiement, s_planning, s_point, s_service, s_signalement,
                          s_souscription, s_user)
from .services import JOURS, NotificationService

ADMIN, CLIENT, EBOUEUR = User.Role.ADMIN, User.Role.CLIENT, User.Role.EBOUEUR
JOURS_OUVRABLES = JOURS[:5]


def corps(request):
    try:
        return json.loads(request.body or b"{}")
    except json.JSONDecodeError:
        return {}


def err(message, status=400, **extra):
    return JsonResponse({"erreur": message, **extra}, status=status)


def dec(valeur):
    return Decimal(str(valeur))


def trouver(modele, pk, **filtres):
    return modele.objects.filter(pk=pk, **filtres).first()


def sur(vue):
    """Convertit les erreurs de saisie en réponses 400."""
    @wraps(vue)
    def wrapper(request, *args, **kwargs):
        try:
            return vue(request, *args, **kwargs)
        except (ValueError, TypeError, KeyError, InvalidOperation) as exc:
            return err(f"Données invalides : {exc}")
    return wrapper


def non_autorise():
    return err("Méthode non autorisée", 405)


# ------------------------------------------------------------------ authentification
@sur
def register(request):
    if request.method != "POST":
        return non_autorise()
    d = corps(request)
    for champ in ("nom", "email", "password"):
        if not d.get(champ):
            return err(f"Champ requis : {champ}")
    if len(d["password"]) < 8:
        return err("Le mot de passe doit contenir au moins 8 caractères")
    email = d["email"].strip().lower()
    if User.objects.filter(email=email).exists():
        return err("Cet email est déjà utilisé", 409)
    user = User(nom=d["nom"].strip(), email=email, telephone=d.get("telephone", ""), role=CLIENT, is_verified=False)
    user.set_password(d["password"])
    user._adresse = d.get("adresse", "")
    user.save()  # le signal génère l'OTP, envoie l'email et crée la notification de bienvenue
    return JsonResponse({"message": "Compte créé. Saisissez le code OTP reçu par email.", "email": email}, status=201)


@sur
def verify_otp(request):
    if request.method != "POST":
        return non_autorise()
    d = corps(request)
    user = User.objects.filter(email=str(d.get("email", "")).strip().lower()).first()
    if not user or not user.verifier_otp(d.get("code", "")):
        return err("Code OTP invalide ou expiré. Demandez un nouveau code.")
    request.auth_user = user
    return JsonResponse({"user": s_user(user), **tokens_pour(user)})


@sur
def resend_otp(request):
    if request.method != "POST":
        return non_autorise()
    user = User.objects.filter(email=str(corps(request).get("email", "")).strip().lower(), is_verified=False).first()
    if user:
        NotificationService.envoyer_email_otp(user, user.generer_otp())
    return JsonResponse({"message": "Si le compte existe, un nouveau code a été envoyé."})


@sur
def login(request):
    if request.method != "POST":
        return non_autorise()
    d = corps(request)
    user = User.objects.filter(email=str(d.get("email", "")).strip().lower()).first()
    if not user or not user.is_active or not user.check_password(d.get("password", "")):
        request.action_log = "LOGIN_ECHEC"
        return err("Identifiants invalides", 401)
    if not user.is_verified:
        request.action_log = "LOGIN_NON_VERIFIE"
        return err("Compte non vérifié. Saisissez le code OTP.", 403, non_verifie=True)
    request.auth_user = user
    request.action_log = "LOGIN_OK"
    return JsonResponse({"user": s_user(user), **tokens_pour(user)})


@sur
def refresh(request):
    if request.method != "POST":
        return non_autorise()
    data = decoder_token(str(corps(request).get("refresh", "")), "refresh")
    user = data and User.objects.filter(pk=data["sub"], is_active=True, is_verified=True).first()
    if not user:
        return err("Refresh token invalide", 401)
    return JsonResponse({"access": creer_token(user, "access")})


@authentifie()
def me(request):
    return JsonResponse(s_user(request.auth_user))


# ------------------------------------------------------------------ utilisateurs (admin)
@authentifie(ADMIN)
@sur
def users(request):
    if request.method == "GET":
        qs = User.objects.all().order_by("-date_creation")
        if request.GET.get("role"):
            qs = qs.filter(role=request.GET["role"])
        return JsonResponse({"items": [s_user(u) for u in qs]})
    if request.method == "POST":
        d = corps(request)
        role = d.get("role", CLIENT)
        if role not in User.Role.values:
            return err("Rôle invalide")
        if not (d.get("nom") and d.get("email") and d.get("password")):
            return err("nom, email et mot de passe requis")
        email = d["email"].strip().lower()
        if User.objects.filter(email=email).exists():
            return err("Cet email est déjà utilisé", 409)
        u = User(nom=d["nom"], email=email, telephone=d.get("telephone", ""), role=role, is_verified=True)
        u.set_password(d["password"])
        u._adresse, u._zone = d.get("adresse", ""), d.get("zone_affectee", "")
        u.save()
        return JsonResponse(s_user(u), status=201)
    return non_autorise()


@authentifie(ADMIN)
@sur
def user_detail(request, pk):
    u = trouver(User, pk)
    if not u:
        return err("Utilisateur introuvable", 404)
    if request.method == "GET":
        return JsonResponse(s_user(u))
    if request.method == "PUT":
        d = corps(request)
        for champ in ("nom", "telephone"):
            if champ in d:
                setattr(u, champ, d[champ])
        if "is_active" in d:
            u.is_active = bool(d["is_active"])
        if d.get("password"):
            u.set_password(d["password"])
        u.save()
        if u.role == CLIENT and hasattr(u, "profil_client") and "adresse" in d:
            u.profil_client.adresse = d["adresse"]
            u.profil_client.save()
        if u.role == EBOUEUR and hasattr(u, "profil_eboueur"):
            pe = u.profil_eboueur
            pe.zone_affectee = d.get("zone_affectee", pe.zone_affectee)
            pe.disponible = bool(d.get("disponible", pe.disponible))
            pe.save()
        return JsonResponse(s_user(u))
    if request.method == "DELETE":
        if u.pk == request.auth_user.pk:
            return err("Vous ne pouvez pas supprimer votre propre compte")
        u.delete()
        return JsonResponse({"supprime": True})
    return non_autorise()


# ------------------------------------------------------------------ services / tarifs
@authentifie()
@sur
def services_view(request):
    if request.method == "GET":
        return JsonResponse({"items": [s_service(s) for s in Service.objects.all().order_by("tarif_mensuel")]})
    if request.auth_user.role != ADMIN:
        return err("Accès refusé", 403)
    if request.method == "POST":
        d = corps(request)
        if d["type"] not in Service.Type.values:
            return err("Type de service invalide")
        s = Service.objects.create(type=d["type"], poids_max_kg=dec(d["poids_max_kg"]),
                                   taille_max=d.get("taille_max", "MOYEN"), tarif_mensuel=dec(d["tarif_mensuel"]))
        return JsonResponse(s_service(s), status=201)
    return non_autorise()


@authentifie()
@sur
def service_detail(request, pk):
    s = trouver(Service, pk)
    if not s:
        return err("Service introuvable", 404)
    if request.method == "GET":
        return JsonResponse(s_service(s))
    if request.auth_user.role != ADMIN:
        return err("Accès refusé", 403)
    if request.method == "PUT":
        d = corps(request)
        if "type" in d and d["type"] in Service.Type.values:
            s.type = d["type"]
        if "poids_max_kg" in d:
            s.poids_max_kg = dec(d["poids_max_kg"])
        if "taille_max" in d:
            s.taille_max = d["taille_max"]
        if "tarif_mensuel" in d:
            s.tarif_mensuel = dec(d["tarif_mensuel"])
        s.save()
        return JsonResponse(s_service(s))
    if request.method == "DELETE":
        try:
            s.delete()
        except ProtectedError:
            return err("Service utilisé par des souscriptions : suppression impossible", 409)
        return JsonResponse({"supprime": True})
    return non_autorise()


# ------------------------------------------------------------------ points de collecte
@authentifie(ADMIN, CLIENT)
@sur
def points(request):
    u = request.auth_user
    if request.method == "GET":
        qs = PointCollecte.objects.select_related("client__user")
        if u.role == CLIENT:
            qs = qs.filter(client__user=u)
        return JsonResponse({"items": [s_point(p) for p in qs.order_by("zone", "adresse")]})
    if request.method == "POST":
        d = corps(request)
        profil = u.profil_client if u.role == CLIENT else ProfilClient.objects.filter(user_id=d.get("client")).first()
        if not profil:
            return err("Client introuvable")
        lat, lon = float(d["latitude"]), float(d["longitude"])
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            return err("Coordonnées GPS invalides")
        if PointCollecte.objects.filter(latitude__range=(lat - 0.0001, lat + 0.0001),
                                        longitude__range=(lon - 0.0001, lon + 0.0001)).exists():
            return err("Un point de collecte existe déjà à cet emplacement", 409)
        p = PointCollecte.objects.create(
            client=profil, latitude=lat, longitude=lon, adresse=d.get("adresse", ""), zone=d.get("zone") or "GENERALE",
            poids_estime=dec(d.get("poids_estime", 20)), taille=d.get("taille", "MOYEN"),
            capacite_max=dec(d.get("capacite_max", 100)))
        return JsonResponse(s_point(p), status=201)
    return non_autorise()


@authentifie(ADMIN, CLIENT)
@sur
def point_detail(request, pk):
    u = request.auth_user
    p = trouver(PointCollecte, pk, **({"client__user": u} if u.role == CLIENT else {}))
    if not p:
        return err("Point introuvable", 404)
    if request.method == "GET":
        return JsonResponse(s_point(p))
    if request.method == "PUT":
        d = corps(request)
        for champ in ("adresse", "zone", "taille"):
            if champ in d:
                setattr(p, champ, d[champ])
        for champ in ("latitude", "longitude"):
            if champ in d:
                setattr(p, champ, float(d[champ]))
        for champ in ("poids_estime", "capacite_max"):
            if champ in d:
                setattr(p, champ, dec(d[champ]))
        p.save()
        return JsonResponse(s_point(p))
    if request.method == "DELETE":
        p.delete()
        return JsonResponse({"supprime": True})
    return non_autorise()


# ------------------------------------------------------------------ souscriptions & paiements
def _recu(souscription, paiement):
    return {"reference": paiement.reference_api if paiement else "GRATUIT-" + str(souscription.id)[:8].upper(),
            "montant": float(paiement.montant) if paiement else 0.0, "service": souscription.service.type,
            "periode": f"{souscription.date_debut:%d/%m/%Y} → {souscription.date_fin:%d/%m/%Y}"}


@authentifie(ADMIN, CLIENT)
@sur
def souscriptions(request):
    u = request.auth_user
    if request.method == "GET":
        qs = Souscription.objects.select_related("service", "client__user").order_by("-date_creation")
        if u.role == CLIENT:
            qs = qs.filter(client__user=u)
        return JsonResponse({"items": [s_souscription(s) for s in qs]})
    if request.method == "POST":
        if u.role != CLIENT:
            return err("Seul un client peut souscrire", 403)
        d = corps(request)
        service = trouver(Service, d.get("service"))
        if not service:
            return err("Service introuvable", 404)
        jours = [j for j in d.get("jours_choisis", [])]
        if any(j not in JOURS_OUVRABLES for j in jours):
            return err("Seuls les jours ouvrables (lundi à vendredi) sont autorisés")
        if service.type == "EXPRESS":
            if len(set(jours)) > 2:
                return err("Maximum 2 jours")
        elif len(set(jours)) != 2:
            return err("Choisissez exactement 2 jours ouvrables")
        profil = u.profil_client
        if not profil.points.filter(temporaire=False).exists():
            return err("Ajoutez d'abord un point de collecte.")
        mois = int(d.get("duree_mois", 3))
        if not 1 <= mois <= 24:
            return err("Durée invalide (1 à 24 mois)")
        debut = timezone.localdate()
        s = Souscription.objects.create(
            client=profil, service=service, date_debut=debut, date_fin=debut + timedelta(days=30 * mois),
            jours_choisis=sorted(set(jours), key=JOURS.index), renouvellement_auto=bool(d.get("renouvellement_auto")),
            mois_gratuits_restants=2 if profil.est_nouveau else 0, poids_estime=dec(d.get("poids_estime", 20)),
            taille=d.get("taille", "MOYEN"))
        paiement, ok = services.finaliser_souscription(s, d.get("mode_paiement", "MOBILE_MONEY"),
                                                       echec=bool(d.get("simuler_echec")))
        s.refresh_from_db()
        if not ok:
            return err("Paiement refusé : la souscription reste en attente.", 402, souscription=s_souscription(s))
        return JsonResponse({"souscription": s_souscription(s), "recu": _recu(s, paiement)}, status=201)
    return non_autorise()


@authentifie(CLIENT)
@sur
def souscription_simuler(request):
    if request.method != "POST":
        return non_autorise()
    d = corps(request)
    service = trouver(Service, d.get("service"))
    if not service:
        return err("Service introuvable", 404)
    profil = request.auth_user.profil_client
    debut = timezone.localdate()
    s = Souscription(client=profil, service=service, date_debut=debut,
                     date_fin=debut + timedelta(days=30 * int(d.get("duree_mois", 3))),
                     mois_gratuits_restants=2 if profil.est_nouveau else 0,
                     poids_estime=dec(d.get("poids_estime", 20)), taille=d.get("taille", "MOYEN"))
    return JsonResponse({"tarif_mensuel": float(service.calculer_tarif(s.poids_estime, s.taille)),
                         "montant_total": float(s.calculer_montant_total()),
                         "gratuit": s.verifier_eligibilite_gratuit(), "mois": s.duree_mois})


@authentifie(CLIENT)
@sur
def souscription_payer(request, pk):
    if request.method != "POST":
        return non_autorise()
    s = trouver(Souscription, pk, client__user=request.auth_user, statut=Souscription.Statut.EN_ATTENTE)
    if not s:
        return err("Souscription en attente introuvable", 404)
    paiement, ok = services.finaliser_souscription(s, corps(request).get("mode_paiement", "MOBILE_MONEY"))
    s.refresh_from_db()
    if not ok:
        return err("Paiement refusé", 402, souscription=s_souscription(s))
    return JsonResponse({"souscription": s_souscription(s), "recu": _recu(s, paiement)})


@authentifie(ADMIN, CLIENT)
def paiements(request):
    qs = Paiement.objects.all().order_by("-date_paiement")
    if request.auth_user.role == CLIENT:
        qs = qs.filter(souscription__client__user=request.auth_user)
    return JsonResponse({"items": [s_paiement(p) for p in qs]})


# ------------------------------------------------------------------ planning
@authentifie()
@sur
def planning_list(request):
    u = request.auth_user
    qs = PlanningCollecte.objects.select_related("eboueur__user", "point_collecte__client__user",
                                                 "souscription__service")
    if request.GET.get("date"):
        qs = qs.filter(date_tournee=date.fromisoformat(request.GET["date"]))
    elif u.role == CLIENT:
        qs = qs.filter(date_tournee__gte=timezone.localdate() - timedelta(days=1))
    else:
        qs = qs.filter(date_tournee=timezone.localdate())
    if u.role == EBOUEUR:
        qs = qs.filter(eboueur__user=u)
    elif u.role == CLIENT:
        qs = qs.filter(point_collecte__client__user=u)
    return JsonResponse({"items": [s_planning(p) for p in qs.order_by("date_tournee", "eboueur_id", "ordre_passage")]})


@authentifie(ADMIN)
@sur
def planning_generer(request):
    if request.method != "POST":
        return non_autorise()
    jour = date.fromisoformat(corps(request).get("date") or timezone.localdate().isoformat())
    return JsonResponse(services.generer_planning(jour))


@authentifie(ADMIN)
@sur
def planning_express(request):
    if request.method != "POST":
        return non_autorise()
    point = trouver(PointCollecte, corps(request).get("point_id"))
    if not point:
        return err("Point introuvable", 404)
    return JsonResponse(s_planning(services.inserer_express(point)), status=201)


def _operation_unitaire(request, pk, action):
    op = {**corps(request), "id": str(pk), "action": action}
    res = services.appliquer_operation(request.auth_user, op)
    return JsonResponse(res, status=200 if res["ok"] else 400)


@authentifie(EBOUEUR)
@sur
def planning_arrivee(request, pk):
    return _operation_unitaire(request, pk, "arrivee")


@authentifie(EBOUEUR)
@sur
def planning_valider(request, pk):
    return _operation_unitaire(request, pk, "valider")


@authentifie(EBOUEUR)
@sur
def planning_incident(request, pk):
    return _operation_unitaire(request, pk, "incident")


@authentifie(EBOUEUR)
@sur
def planning_sync(request):
    """Rejoue, dans l'ordre, la file d'opérations enregistrées hors-ligne."""
    if request.method != "POST":
        return non_autorise()
    resultats = []
    for op in corps(request).get("operations", []):
        res = services.appliquer_operation(request.auth_user, op)
        resultats.append({"id": op.get("id"), "action": op.get("action"), **res})
    return JsonResponse({"resultats": resultats})


# ------------------------------------------------------------------ signalements
@authentifie(ADMIN, CLIENT)
@sur
def signalements(request):
    u = request.auth_user
    if request.method == "GET":
        qs = SignalementCitoyen.objects.select_related("client__user")
        if u.role == CLIENT:
            qs = qs.filter(client__user=u)
        return JsonResponse({"items": [s_signalement(s) for s in qs]})
    if request.method == "POST":
        if u.role != CLIENT:
            return err("Seul un client peut signaler", 403)
        d = corps(request)
        s = SignalementCitoyen.objects.create(client=u.profil_client, photo_url=d.get("photo_url", ""),
                                              latitude=float(d["latitude"]), longitude=float(d["longitude"]),
                                              description=d.get("description", ""))
        NotificationService.notifier_admins("⚠️ Signalement de dépôt sauvage", f"{u.nom} : {s.description or 'sans description'}")
        return JsonResponse(s_signalement(s), status=201)
    return non_autorise()


@authentifie(ADMIN)
@sur
def signalement_convertir(request, pk):
    s = trouver(SignalementCitoyen, pk, statut=SignalementCitoyen.Statut.OUVERT)
    if not s:
        return err("Signalement ouvert introuvable", 404)
    return JsonResponse(s_planning(services.convertir_signalement(s)))


@authentifie(ADMIN)
@sur
def signalement_traiter(request, pk):
    s = trouver(SignalementCitoyen, pk)
    if not s:
        return err("Signalement introuvable", 404)
    s.statut = SignalementCitoyen.Statut.TRAITE
    s.save()
    return JsonResponse(s_signalement(s))


# ------------------------------------------------------------------ notifications
@authentifie()
def notifications(request):
    qs = Notification.objects.filter(destinataire=request.auth_user)
    return JsonResponse({"items": [s_notification(n) for n in qs[:100]], "non_lues": qs.filter(est_lue=False).count()})


@authentifie()
def notification_lire(request, pk):
    Notification.objects.filter(pk=pk, destinataire=request.auth_user).update(est_lue=True)
    return JsonResponse({"ok": True})


@authentifie()
def notifications_lire_tout(request):
    Notification.objects.filter(destinataire=request.auth_user, est_lue=False).update(est_lue=True)
    return JsonResponse({"ok": True})


# ------------------------------------------------------------------ dashboard & monitoring
@authentifie(ADMIN)
def dashboard(request):
    P = PlanningCollecte.Statut
    revenus = Paiement.objects.filter(statut=Paiement.Statut.REUSSI).aggregate(t=Sum("montant"))["t"] or 0
    tonnage = PlanningCollecte.objects.filter(statut=P.EFFECTUE).aggregate(t=Sum("point_collecte__poids_estime"))["t"] or 0
    effectues = PlanningCollecte.objects.filter(statut=P.EFFECTUE).count()
    termines = PlanningCollecte.objects.filter(statut__in=[P.EFFECTUE, P.ECHEC]).count()
    return JsonResponse({
        "revenus": float(revenus), "tonnage_kg": float(tonnage),
        "abonnements_actifs": Souscription.objects.filter(statut=Souscription.Statut.ACTIVE).count(),
        "taux_collecte": round(100 * effectues / termines, 1) if termines else 0,
        "signalements_ouverts": SignalementCitoyen.objects.filter(statut=SignalementCitoyen.Statut.OUVERT).count(),
        "utilisateurs": User.objects.count()})


@authentifie(ADMIN)
def logs(request):
    return JsonResponse({"items": [s_log(l) for l in LogMonitoring.objects.select_related("utilisateur")[:100]]})
