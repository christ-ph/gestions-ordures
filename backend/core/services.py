"""Services métier : notifications, paiement simulé, planification, synchronisation."""
import secrets
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from .algorithms import Collecteur, GrapheCollecte, Tache, affecter_taches
from .models import (Notification, Paiement, PlanningCollecte, PointCollecte, ProfilEboueur,
                     Souscription, User)

JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]
HEURE_LIMITE = {1: 10.0, 2: 14.0, 3: 18.0}  # échéances EDF par priorité


class NotificationService:
    @staticmethod
    def creer_notif_interne(user, titre, message, type_=Notification.Type.SYSTEME):
        return Notification.objects.create(destinataire=user, titre=titre, message=message, type=type_)

    @staticmethod
    def _email(user, sujet, corps):
        try:
            send_mail(sujet, corps, settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=False)
        except Exception as exc:  # SMTP indisponible : on n'interrompt pas le flux métier
            print(f"[EMAIL] échec d'envoi à {user.email} : {exc}")

    @classmethod
    def envoyer_email_otp(cls, user, code):
        if settings.DEBUG:
            print(f"\n[OTP] {user.email} -> {code}\n")
        cls._email(user, "Votre code de vérification",
                   f"Bonjour {user.nom},\n\nVotre code OTP est : {code}\n"
                   f"Il est valable {settings.OTP_VALIDITE_MINUTES} minutes.")

    @classmethod
    def notifier_admins(cls, titre, message):
        for admin in User.objects.filter(role=User.Role.ADMIN, is_active=True):
            cls.creer_notif_interne(admin, titre, message)

    @classmethod
    def notifier_abonnement(cls, souscription):
        user = souscription.client.user
        msg = (f"Votre abonnement {souscription.service.type} est actif jusqu'au "
               f"{souscription.date_fin:%d/%m/%Y}. Jours : {', '.join(souscription.jours_choisis) or 'à la demande'}.")
        cls.creer_notif_interne(user, "Abonnement confirmé", msg, Notification.Type.ABONNEMENT)
        cls._email(user, "Confirmation de votre abonnement", msg)
        cls.notifier_admins("Nouvelle souscription", f"{user.nom} a souscrit au plan {souscription.service.type}.")

    @classmethod
    def notifier_arrivee(cls, planning):
        cls.creer_notif_interne(planning.point_collecte.client.user, "🚨 Éboueur arrivé",
                                "Votre éboueur est arrivé devant votre point de collecte",
                                Notification.Type.ARRIVEE_EBOUEUR)

    @classmethod
    def notifier_collecte_validee(cls, planning):
        cls.creer_notif_interne(planning.point_collecte.client.user, "Collecte effectuée",
                                "Votre bac a bien été collecté. Merci !", Notification.Type.COLLECTE_VALIDEE)

    @classmethod
    def notifier_incident(cls, planning):
        client = planning.point_collecte.client.user
        motif = planning.incident_motif or "incident terrain"
        cls.creer_notif_interne(client, "Collecte impossible", f"Votre collecte n'a pas pu être effectuée : {motif}.")
        cls.notifier_admins("Incident terrain", f"{planning.point_collecte.adresse or 'Point'} : {motif}.")


def simuler_paiement(souscription, montant, mode, echec=False):
    return Paiement.objects.create(
        souscription=souscription, montant=montant, mode=mode,
        reference_api="PAY-" + secrets.token_hex(6).upper(),
        statut=Paiement.Statut.ECHEC if echec else Paiement.Statut.REUSSI,
    )


def finaliser_souscription(souscription, mode="MOBILE_MONEY", echec=False):
    """Retourne (paiement|None, succes). Le montant est calculé avant l'activation."""
    montant = souscription.calculer_montant_total()
    if montant <= 0:  # offre des 2 mois gratuits
        souscription.activer_souscription()
        return None, True
    paiement = simuler_paiement(souscription, montant, mode, echec)
    if paiement.statut == Paiement.Statut.REUSSI:
        souscription.activer_souscription()
        return paiement, True
    NotificationService.creer_notif_interne(
        souscription.client.user, "Échec du paiement",
        "Votre paiement a échoué. Votre souscription reste en attente : veuillez réessayer.")
    return paiement, False


@transaction.atomic
def generer_planning(date_cible):
    eboueurs = list(ProfilEboueur.objects.filter(disponible=True, user__is_active=True).select_related("user"))
    if not eboueurs:
        raise ValueError("Aucun éboueur disponible.")
    PlanningCollecte.objects.filter(date_tournee=date_cible, statut=PlanningCollecte.Statut.PLANIFIE,
                                    souscription__isnull=False).delete()
    deja = set(PlanningCollecte.objects.filter(date_tournee=date_cible)
               .values_list("point_collecte_id", "souscription_id"))
    jour = JOURS[date_cible.weekday()]

    taches, index = [], {}
    abonnements = (Souscription.objects.filter(statut=Souscription.Statut.ACTIVE,
                                               date_debut__lte=date_cible, date_fin__gte=date_cible)
                   .select_related("service", "client"))
    for s in abonnements:
        if s.jours_choisis:
            concerne = jour in s.jours_choisis
        else:
            concerne = s.service.type == "EXPRESS" and date_cible.weekday() < 5
        if not concerne:
            continue
        prio = s.service.obtenir_priorite()
        for p in s.client.points.filter(temporaire=False):
            if (p.id, s.id) in deja:
                continue
            cle = f"{s.id}|{p.id}"
            taches.append(Tache(cle, prio, HEURE_LIMITE[prio], p.zone, float(p.poids_estime), p.latitude, p.longitude))
            index[cle] = (s, p)

    collecteurs = [Collecteur(str(e.id), e.zone_affectee, float(settings.CAPACITE_EBOUEUR_KG)) for e in eboueurs]
    tournees, non_affectees = affecter_taches(taches, collecteurs)
    par_id = {str(e.id): e for e in eboueurs}

    crees, nb_eboueurs = 0, 0
    for eid, liste in tournees.items():
        if not liste:
            continue
        e = par_id[eid]
        graphe = GrapheCollecte([(t.id, t.lat, t.lon) for t in liste])
        ordre = graphe.tournee_optimale(depart=0)  # départ = tâche la plus urgente
        debut = e.plannings.filter(date_tournee=date_cible).aggregate(m=Max("ordre_passage"))["m"] or 0
        for rang, i in enumerate(ordre, start=1):
            s, p = index[liste[i].id]
            PlanningCollecte.objects.create(eboueur=e, point_collecte=p, souscription=s,
                                            date_tournee=date_cible, ordre_passage=debut + rang)
            crees += 1
        nb_eboueurs += 1
        NotificationService.creer_notif_interne(e.user, "Nouvelle tournée",
                                                f"{len(liste)} collecte(s) planifiée(s) le {date_cible:%d/%m/%Y}.")
    return {"crees": crees, "eboueurs": nb_eboueurs, "non_affectees": len(non_affectees)}


@transaction.atomic
def inserer_express(point, date_cible=None):
    """Insertion incrémentale d'une collecte Express dans la tournée active la moins coûteuse."""
    date_cible = date_cible or timezone.localdate()
    eboueurs = list(ProfilEboueur.objects.filter(disponible=True, user__is_active=True).select_related("user"))
    if not eboueurs:
        raise ValueError("Aucun éboueur disponible.")
    meilleur = None
    actifs = [PlanningCollecte.Statut.PLANIFIE, PlanningCollecte.Statut.SUR_PLACE]
    for e in eboueurs:
        restants = list(e.plannings.filter(date_tournee=date_cible, statut__in=actifs)
                        .select_related("point_collecte").order_by("ordre_passage"))
        graphe = GrapheCollecte([(p.id, p.point_collecte.latitude, p.point_collecte.longitude) for p in restants])
        k = graphe.ajouter((point.id, point.latitude, point.longitude))
        figes = sum(1 for p in restants if p.statut == PlanningCollecte.Statut.SUR_PLACE)
        cout, pos = graphe.cout_insertion(list(range(len(restants))), k, a_partir_de=figes)
        if meilleur is None or cout < meilleur[0]:
            meilleur = (cout, e, restants, pos)
    _, e, restants, pos = meilleur
    if restants:
        base = restants[0].ordre_passage
    else:
        base = (e.plannings.filter(date_tournee=date_cible).aggregate(m=Max("ordre_passage"))["m"] or 0) + 1
    nouveau = PlanningCollecte.objects.create(eboueur=e, point_collecte=point, souscription=None,
                                              date_tournee=date_cible, ordre_passage=base)
    sequence = restants[:pos] + [nouveau] + restants[pos:]
    for rang, p in enumerate(sequence):
        if p.ordre_passage != base + rang:
            p.ordre_passage = base + rang
            p.save(update_fields=["ordre_passage"])
    NotificationService.creer_notif_interne(e.user, "Collecte Express urgente",
                                            f"Nouveau point inséré dans votre tournée : {point.adresse or point.zone}.")
    nouveau.refresh_from_db()
    return nouveau


@transaction.atomic
def convertir_signalement(signalement):
    premier = signalement.client.points.first()
    point = PointCollecte.objects.create(
        client=signalement.client, latitude=signalement.latitude, longitude=signalement.longitude,
        adresse="Dépôt sauvage signalé", zone=premier.zone if premier else "SIGNALEMENT",
        poids_estime=Decimal("50"), capacite_max=Decimal("200"), temporaire=True)
    planning = inserer_express(point)
    signalement.statut = signalement.Statut.CONVERTI_EXPRESS
    signalement.planning_express = planning
    signalement.save()
    NotificationService.creer_notif_interne(signalement.client.user, "Signalement pris en charge",
                                            "Votre signalement a été converti en collecte Express.")
    return planning


def appliquer_operation(user, op):
    """Applique une opération éboueur : arrivee | valider | incident (idempotent)."""
    try:
        p = (PlanningCollecte.objects.select_related("point_collecte__client__user")
             .filter(pk=op.get("id"), eboueur__user=user).first())
    except (ValueError, ValidationError):
        p = None
    if not p:
        return {"ok": False, "erreur": "Planning introuvable"}
    action = op.get("action")
    S = PlanningCollecte.Statut
    if action == "arrivee":
        if p.statut == S.PLANIFIE:
            p.notifier_client_arrivee()
        return {"ok": True}
    if action == "valider":
        if p.statut == S.EFFECTUE:
            return {"ok": True}
        try:
            p.marquer_effectuee(qr=op.get("qr"), latitude=op.get("latitude"), longitude=op.get("longitude"))
        except ValueError as exc:
            return {"ok": False, "erreur": str(exc)}
        return {"ok": True}
    if action == "incident":
        if p.statut != S.EFFECTUE:
            p.incident_motif = str(op.get("motif") or "Bac absent ou inaccessible")[:255]
            p.statut = S.ECHEC
            p.save()
        return {"ok": True}
    return {"ok": False, "erreur": "Action inconnue"}


def envoyer_rappels():
    demain = timezone.localdate() + timedelta(days=1)
    n = 0
    for p in PlanningCollecte.objects.filter(date_tournee=demain, statut=PlanningCollecte.Statut.PLANIFIE) \
            .select_related("point_collecte__client__user"):
        NotificationService.creer_notif_interne(
            p.point_collecte.client.user, "Rappel de collecte",
            f"Collecte prévue demain ({demain:%d/%m/%Y}). Pensez à sortir votre bac.", Notification.Type.RAPPEL)
        n += 1
    j7 = timezone.localdate() + timedelta(days=7)
    for s in Souscription.objects.filter(statut=Souscription.Statut.ACTIVE, date_fin=j7).select_related("client__user"):
        NotificationService.creer_notif_interne(
            s.client.user, "Votre abonnement se termine bientôt",
            f"Votre abonnement prend fin le {s.date_fin:%d/%m/%Y} (J-7).", Notification.Type.RAPPEL)
        n += 1
    return n
