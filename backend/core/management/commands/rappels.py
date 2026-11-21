from django.core.management.base import BaseCommand

from core.services import envoyer_rappels


class Command(BaseCommand):
    help = "Rappels de la veille (20h) et alertes J-7 de fin d'abonnement"

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS(f"{envoyer_rappels()} rappel(s) envoyé(s)."))
