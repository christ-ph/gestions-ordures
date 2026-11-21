import hmac
import math
import secrets
import uuid
from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings
from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.db import models
from django.utils import timezone

from .algorithms import haversine

RANG_TAILLE = {"PETIT": 0, "MOYEN": 1, "GRAND": 2}


class Taille(models.TextChoices):
    PETIT = "PETIT", "Petit"
    MOYEN = "MOYEN", "Moyen"
    GRAND = "GRAND", "Grand"


def generer_qr():
    return "BIN-" + secrets.token_hex(6).upper()


# ----------------------------------------------------------------------- Utilisateurs
class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra):
        if not email:
            raise ValueError("Email requis")
        user = self.model(email=self.normalize_email(email), **extra)
        user.set_password(password)
        user.save()
        return user


class User(AbstractBaseUser):
    class Role(models.TextChoices):
        ADMIN = "ADMIN", "Admin"
        CLIENT = "CLIENT", "Client"
        EBOUEUR = "EBOUEUR", "Éboueur"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nom = models.CharField(max_length=150)
    email = models.EmailField(unique=True)
    telephone = models.CharField(max_length=30, blank=True)
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.CLIENT)
    otp_code = models.CharField(max_length=6, blank=True, default="")
    otp_expiration = models.DateTimeField(null=True, blank=True)
    is_verified = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    date_creation = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["nom"]
    objects = UserManager()

    def __str__(self):
        return f"{self.nom} <{self.email}>"

    def generer_otp(self):
        self.otp_code = f"{secrets.randbelow(10 ** 6):06d}"
        self.otp_expiration = timezone.now() + timedelta(minutes=settings.OTP_VALIDITE_MINUTES)
        self.save(update_fields=["otp_code", "otp_expiration"])
        return self.otp_code

    def verifier_otp(self, code):
        if not self.otp_code or not self.otp_expiration or timezone.now() > self.otp_expiration:
            return False
        if not hmac.compare_digest(self.otp_code, str(code).strip()):
            return False
        self.is_verified = True
        self.otp_code = ""
        self.otp_expiration = None
        self.save(update_fields=["is_verified", "otp_code", "otp_expiration"])
        return True


class ProfilAdmin(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profil_admin")
    matricule = models.CharField(max_length=30, blank=True)


class ProfilClient(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profil_client")
    adresse = models.CharField(max_length=255, blank=True)
    qr_code_unique = models.CharField(max_length=40, unique=True, default=generer_qr)
    est_nouveau = models.BooleanField(default=True)


class ProfilEboueur(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profil_eboueur")
    zone_affectee = models.CharField(max_length=100, blank=True)
    disponible = models.BooleanField(default=True)


# ----------------------------------------------------------------------- Services
class Service(models.Model):
    class Type(models.TextChoices):
        STANDARD = "STANDARD", "Standard"
        EXPRESS = "EXPRESS", "Express"
        VIP = "VIP", "VIP"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    type = models.CharField(max_length=10, choices=Type.choices)
    poids_max_kg = models.DecimalField(max_digits=8, decimal_places=2)
    taille_max = models.CharField(max_length=10, choices=Taille.choices, default=Taille.MOYEN)
    tarif_mensuel = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return self.type

    def calculer_tarif(self, poids, taille):
        """Tarif mensuel : +10 % par tranche de 10 kg au-dessus du plafond, +25 % par cran de taille."""
        coeff = Decimal("1")
        poids = Decimal(str(poids or 0))
        plafond = Decimal(str(self.poids_max_kg))
        if poids > plafond:
            coeff += Decimal("0.10") * math.ceil(float(poids - plafond) / 10)
        ecart = RANG_TAILLE.get(taille, 1) - RANG_TAILLE.get(self.taille_max, 1)
        if ecart > 0:
            coeff += Decimal("0.25") * ecart
        return (Decimal(str(self.tarif_mensuel)) * coeff).quantize(Decimal("1"), rounding=ROUND_HALF_UP)

    def obtenir_priorite(self):
        return {"EXPRESS": 1, "VIP": 2, "STANDARD": 3}[self.type]


class Souscription(models.Model):
    class Statut(models.TextChoices):
        EN_ATTENTE = "EN_ATTENTE", "En attente"
        ACTIVE = "ACTIVE", "Active"
        EXPIREE = "EXPIREE", "Expirée"
        ANNULEE = "ANNULEE", "Annulée"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client = models.ForeignKey(ProfilClient, on_delete=models.CASCADE, related_name="souscriptions")
    service = models.ForeignKey(Service, on_delete=models.PROTECT, related_name="souscriptions")
    date_debut = models.DateField(default=timezone.localdate)
    date_fin = models.DateField()
    jours_choisis = models.JSONField(default=list)
    mois_gratuits_restants = models.IntegerField(default=2)
    renouvellement_auto = models.BooleanField(default=False)
    statut = models.CharField(max_length=12, choices=Statut.choices, default=Statut.EN_ATTENTE)
    poids_estime = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    taille = models.CharField(max_length=10, choices=Taille.choices, default=Taille.MOYEN)
    date_creation = models.DateTimeField(auto_now_add=True)

    @property
    def duree_mois(self):
        return max(1, math.ceil((self.date_fin - self.date_debut).days / 30))

    def verifier_eligibilite_gratuit(self):
        return bool(self.client.est_nouveau and self.mois_gratuits_restants > 0)

    def calculer_montant_total(self):
        mois = self.duree_mois
        gratuits = min(mois, self.mois_gratuits_restants) if self.verifier_eligibilite_gratuit() else 0
        return self.service.calculer_tarif(self.poids_estime, self.taille) * (mois - gratuits)

    def activer_souscription(self):
        if self.verifier_eligibilite_gratuit():
            self.mois_gratuits_restants -= min(self.duree_mois, self.mois_gratuits_restants)
        self.statut = self.Statut.ACTIVE
        self.save()
        if self.client.est_nouveau:
            self.client.est_nouveau = False
            self.client.save(update_fields=["est_nouveau"])


# ----------------------------------------------------------------------- Collecte
class PointCollecte(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client = models.ForeignKey(ProfilClient, on_delete=models.CASCADE, related_name="points")
    latitude = models.FloatField()
    longitude = models.FloatField()
    adresse = models.CharField(max_length=255, blank=True)
    zone = models.CharField(max_length=100, default="GENERALE")
    poids_estime = models.DecimalField(max_digits=8, decimal_places=2, default=20)
    taille = models.CharField(max_length=10, choices=Taille.choices, default=Taille.MOYEN)
    capacite_max = models.DecimalField(max_digits=8, decimal_places=2, default=100)
    temporaire = models.BooleanField(default=False)  # points issus de signalements

    def calculer_distance_vers(self, autre):
        """Distance de Haversine (km) vers un autre PointCollecte."""
        return haversine(self.latitude, self.longitude, autre.latitude, autre.longitude)


class PlanningCollecte(models.Model):
    class Statut(models.TextChoices):
        PLANIFIE = "PLANIFIE", "Planifié"
        SUR_PLACE = "SUR_PLACE", "Sur place"
        EFFECTUE = "EFFECTUE", "Effectué"
        ECHEC = "ECHEC", "Échec"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    eboueur = models.ForeignKey(ProfilEboueur, on_delete=models.CASCADE, related_name="plannings")
    point_collecte = models.ForeignKey(PointCollecte, on_delete=models.CASCADE, related_name="plannings")
    souscription = models.ForeignKey(Souscription, on_delete=models.SET_NULL, null=True, blank=True,
                                     related_name="plannings")
    date_tournee = models.DateField()
    ordre_passage = models.IntegerField(default=1)
    statut = models.CharField(max_length=10, choices=Statut.choices, default=Statut.PLANIFIE)
    heure_arrivee = models.DateTimeField(null=True, blank=True)
    preuve_qr_code = models.CharField(max_length=120, blank=True)
    est_synchronise = models.BooleanField(default=True)
    incident_motif = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["date_tournee", "ordre_passage"]

    @property
    def priorite(self):
        return self.souscription.service.obtenir_priorite() if self.souscription else 1

    def notifier_client_arrivee(self):
        """Passe au statut SUR_PLACE : le signal post_save notifie le client."""
        self.statut = self.Statut.SUR_PLACE
        self.heure_arrivee = timezone.now()
        self.save()

    def marquer_effectuee(self, qr=None, latitude=None, longitude=None):
        """Valide la collecte par QR Code (celui du client) ou par proximité GPS (150 m)."""
        client = self.point_collecte.client
        if qr:
            if not hmac.compare_digest(str(qr), client.qr_code_unique):
                raise ValueError("QR Code invalide pour ce client")
            self.preuve_qr_code = str(qr)
        elif latitude is not None and longitude is not None:
            distance_m = haversine(float(latitude), float(longitude),
                                   self.point_collecte.latitude, self.point_collecte.longitude) * 1000
            if distance_m > 150:
                raise ValueError(f"Position trop éloignée du point de collecte ({int(distance_m)} m)")
            self.preuve_qr_code = f"GPS:{float(latitude):.6f},{float(longitude):.6f}"
        else:
            raise ValueError("Preuve requise : QR Code ou position GPS")
        self.statut = self.Statut.EFFECTUE
        self.est_synchronise = True
        self.save()


# ----------------------------------------------------------------------- Paiement & notifications
class Paiement(models.Model):
    class Mode(models.TextChoices):
        MOBILE_MONEY = "MOBILE_MONEY", "Mobile Money"
        CARTE = "CARTE", "Carte bancaire"

    class Statut(models.TextChoices):
        EN_ATTENTE = "EN_ATTENTE", "En attente"
        REUSSI = "REUSSI", "Réussi"
        ECHEC = "ECHEC", "Échec"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    souscription = models.ForeignKey(Souscription, on_delete=models.CASCADE, related_name="paiements")
    montant = models.DecimalField(max_digits=12, decimal_places=2)
    mode = models.CharField(max_length=15, choices=Mode.choices)
    reference_api = models.CharField(max_length=60, blank=True)
    statut = models.CharField(max_length=12, choices=Statut.choices, default=Statut.EN_ATTENTE)
    date_paiement = models.DateTimeField(auto_now_add=True)


class Notification(models.Model):
    class Type(models.TextChoices):
        OTP = "OTP", "OTP"
        ABONNEMENT = "ABONNEMENT", "Abonnement"
        ARRIVEE_EBOUEUR = "ARRIVEE_EBOUEUR", "Arrivée éboueur"
        COLLECTE_VALIDEE = "COLLECTE_VALIDEE", "Collecte validée"
        RAPPEL = "RAPPEL", "Rappel"
        SYSTEME = "SYSTEME", "Système"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    destinataire = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notifications")
    titre = models.CharField(max_length=150)
    message = models.TextField()
    type = models.CharField(max_length=20, choices=Type.choices, default=Type.SYSTEME)
    est_lue = models.BooleanField(default=False)
    date_envoi = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date_envoi"]


class SignalementCitoyen(models.Model):
    class Statut(models.TextChoices):
        OUVERT = "OUVERT", "Ouvert"
        CONVERTI_EXPRESS = "CONVERTI_EXPRESS", "Converti en Express"
        TRAITE = "TRAITE", "Traité"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client = models.ForeignKey(ProfilClient, on_delete=models.CASCADE, related_name="signalements")
    photo_url = models.TextField(blank=True)
    latitude = models.FloatField()
    longitude = models.FloatField()
    description = models.TextField(blank=True)
    statut = models.CharField(max_length=20, choices=Statut.choices, default=Statut.OUVERT)
    planning_express = models.OneToOneField(PlanningCollecte, null=True, blank=True,
                                            on_delete=models.SET_NULL, related_name="signalement")
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date_creation"]


class LogMonitoring(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    utilisateur = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="logs")
    action = models.CharField(max_length=120)
    endpoint = models.CharField(max_length=255)
    statut_http = models.IntegerField()
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-timestamp"]
