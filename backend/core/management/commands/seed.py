from django.core.management.base import BaseCommand
from core.models import PointCollecte, Service, User

class Command(BaseCommand):
    help = "Crée les comptes, services et points de démonstration"

    def handle(self, *args, **options):
        def creer(email, nom, role, mdp):
            u = User.objects.filter(email=email).first()
            if not u:
                u = User(email=email, nom=nom, role=role, telephone="+237600000000", is_verified=True)
                u.set_password(mdp)
                u.save()
            return u

        # 1. Création des utilisateurs
        creer("admin@gestion.cm", "Administrateur", "ADMIN", "Admin1234!")
        eboueur = creer("eboueur1@gestion.cm", "Eboueur Centre", "EBOUEUR", "Eboueur1234!")
        client = creer("client@gestion.cm", "Client Démo", "CLIENT", "Client1234!")

        # 2. Mise à jour explicite des profils (pour éviter les bugs si le compte existe déjà)
        if hasattr(eboueur, 'profil_eboueur'):
            eboueur.profil_eboueur.zone_affectee = "Centre"
            eboueur.profil_eboueur.save()
            
        if hasattr(client, 'profil_client'):
            client.profil_client.adresse = "Yaoundé, Centre"
            client.profil_client.save()

        # 3. Création des services
        for type_, poids, taille, tarif in [("STANDARD", 50, "MOYEN", 5000), ("EXPRESS", 100, "GRAND", 15000),
                                            ("VIP", 150, "GRAND", 25000)]:
            Service.objects.get_or_create(type=type_, defaults={"poids_max_kg": poids, "taille_max": taille,
                                                                 "tarif_mensuel": tarif})

        # 4. Création des points de collecte
        demo = [("Avenue Kennedy", "Centre", 3.8667, 11.5174),
                ("Marché Central", "Centre", 3.8615, 11.5200)]
        
        # On s'assure que le client a bien un profil avant d'ajouter les points
        if hasattr(client, 'profil_client'):
            for adresse, zone, lat, lon in demo:
                if not PointCollecte.objects.filter(client=client.profil_client, adresse=adresse).exists():
                    PointCollecte.objects.create(client=client.profil_client, adresse=adresse, zone=zone,
                                                 latitude=lat, longitude=lon, poids_estime=25)
                                                
        self.stdout.write(self.style.SUCCESS("Données de démonstration prêtes."))
