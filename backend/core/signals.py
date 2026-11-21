from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from .models import (Notification, PlanningCollecte, ProfilAdmin, ProfilClient, ProfilEboueur,
                     Souscription, User)
from .services import NotificationService


@receiver(post_save, sender=User)
def utilisateur_cree(sender, instance, created, **kwargs):
    if not created:
        return
    if instance.role == User.Role.ADMIN:
        ProfilAdmin.objects.get_or_create(user=instance, defaults={"matricule": f"ADM-{instance.id.hex[:6].upper()}"})
    elif instance.role == User.Role.CLIENT:
        ProfilClient.objects.get_or_create(user=instance, defaults={"adresse": getattr(instance, "_adresse", "")})
    else:
        ProfilEboueur.objects.get_or_create(user=instance, defaults={"zone_affectee": getattr(instance, "_zone", "")})
    if not instance.is_verified:
        code = instance.generer_otp()
        NotificationService.envoyer_email_otp(instance, code)
        NotificationService.creer_notif_interne(
            instance, "Code de vérification", "Un code OTP à 6 chiffres vous a été envoyé par email.",
            Notification.Type.OTP)
    NotificationService.creer_notif_interne(
        instance, "Bienvenue", f"Bienvenue {instance.nom} sur la plateforme de gestion des ordures !")


@receiver(pre_save, sender=Souscription)
def souscription_avant(sender, instance, **kwargs):
    instance._ancien_statut = sender.objects.filter(pk=instance.pk).values_list("statut", flat=True).first()


@receiver(post_save, sender=Souscription)
def souscription_apres(sender, instance, **kwargs):
    if instance.statut == Souscription.Statut.ACTIVE and instance._ancien_statut != Souscription.Statut.ACTIVE:
        NotificationService.notifier_abonnement(instance)


@receiver(pre_save, sender=PlanningCollecte)
def planning_avant(sender, instance, **kwargs):
    instance._ancien_statut = sender.objects.filter(pk=instance.pk).values_list("statut", flat=True).first()


@receiver(post_save, sender=PlanningCollecte)
def planning_apres(sender, instance, **kwargs):
    ancien, S = instance._ancien_statut, PlanningCollecte.Statut
    if instance.statut == ancien:
        return
    if instance.statut == S.SUR_PLACE:
        NotificationService.notifier_arrivee(instance)
    elif instance.statut == S.EFFECTUE:
        NotificationService.notifier_collecte_validee(instance)
    elif instance.statut == S.ECHEC:
        NotificationService.notifier_incident(instance)
