from django.core.management.base import BaseCommand

from core.models import PointCollecte, Service, User


class Command(BaseCommand):
    help = "Crée les comptes, services et points de démonstration"

    def handle(self, *args, **options):
        def creer(email, nom, role, mdp, **extra):
            u = User.objects.filter(email=email).first()
            if u:
                return u
            u = User(email=email, nom=nom, role=role, telephone="+237600000000", is_verified=True)
            u.set_password(mdp)
            for k, v in extra.items():
                setattr(u, k, v)
            u.save()
            return u

        creer("admin@gestion.cm", "Administrateur", "ADMIN", "Admin1234!")
        creer("eboueur1@gestion.cm", "Eboueur Centre", "EBOUEUR", "Eboueur1234!", _zone="Centre")
        creer("eboueur2@gestion.cm", "Eboueur Bastos", "EBOUEUR", "Eboueur1234!", _zone="Bastos")
        client = creer("client@gestion.cm", "Client Démo", "CLIENT", "Client1234!", _adresse="Yaoundé, Centre")
        client2 = creer("client2@gestion.cm", "Marie Nguema", "CLIENT", "Client1234!", _adresse="Yaoundé, Bastos")

        for type_, poids, taille, tarif in [("STANDARD", 50, "MOYEN", 5000), ("EXPRESS", 100, "GRAND", 15000),
                                            ("VIP", 150, "GRAND", 25000)]:
            Service.objects.get_or_create(type=type_, defaults={"poids_max_kg": poids, "taille_max": taille,
                                                                 "tarif_mensuel": tarif})

        demo = [(client, "Avenue Kennedy", "Centre", 3.8667, 11.5174),
                (client, "Marché Central", "Centre", 3.8615, 11.5200),
                (client2, "Quartier Bastos", "Bastos", 3.8970, 11.5160)]
        for c, adresse, zone, lat, lon in demo:
            if not PointCollecte.objects.filter(client=c.profil_client, adresse=adresse).exists():
                PointCollecte.objects.create(client=c.profil_client, adresse=adresse, zone=zone,
                                             latitude=lat, longitude=lon, poids_estime=25)
        self.stdout.write(self.style.SUCCESS("Données de démonstration prêtes."))
